
require('dotenv').config();
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const ExcelJS = require('exceljs');
const open = require('open');
const path = require('path');

const app = express();
// We don't need cors or express.json for the WebSocket server, but it's good practice to keep them for potential future REST endpoints.
app.use(express.json());

// Serve the static files from the React app
app.use(express.static(path.join(__dirname, '../client/build')));

// Handles any requests that don't match the ones above
app.get('*', (req,res) =>{
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Create an HTTP server from the Express app
const server = http.createServer(app);

// Create a WebSocket server and attach it to the HTTP server
const wss = new WebSocketServer({ server });

console.log('WebSocket Server created');

wss.on('connection', (ws) => {
  console.log('Client connected');
  let isCancelled = false;

  ws.on('message', async (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'START_GENERATION':
        console.log('Received START_GENERATION');
        isCancelled = false;
        await generateCodes(ws, data.payload, () => isCancelled);
        break;
      
      case 'CANCEL_GENERATION':
        console.log('Received CANCEL_GENERATION');
        isCancelled = true;
        break;
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    isCancelled = true; // Ensure generation stops if client disconnects
  });

  ws.on('error', (error) => {
    console.error('WebSocket Error:', error);
    isCancelled = true;
  });
});

async function generateCodes(ws, { coupon, count, prefix, minimumAmount, minimumAmountCurrency, user }, isCancelledCheck) {
  let generatedCodes = [];
  const generationDate = new Date();

  try {
    for (let i = 0; i < count; i++) {
      if (isCancelledCheck()) {
        console.log('Generation cancelled by client.');
        ws.send(JSON.stringify({ type: 'GENERATION_CANCELLED' }));
        return;
      }

      const promotionCodeParams = {
        coupon: coupon,
        code: prefix ? `${prefix}${generateRandomString(8)}` : undefined,
        max_redemptions: 1,
      };

      if (minimumAmount && minimumAmountCurrency) {
        promotionCodeParams.restrictions = {
          minimum_amount: parseInt(minimumAmount, 10),
          minimum_amount_currency: minimumAmountCurrency,
        };
      }

      const promoCode = await stripe.promotionCodes.create(promotionCodeParams);
      generatedCodes.push(promoCode.code);

      ws.send(JSON.stringify({
        type: 'PROGRESS_UPDATE',
        payload: { generated: i + 1, total: count },
      }));

      if ((i + 1) % 4000 === 0 && (i + 1) < count) {
        const fileName = `promo-codes-part-${Math.ceil((i + 1) / 4000)}-${generationDate.toISOString().split('T')[0]}.xlsx`;
        const fileContents = await createExcelFile(generatedCodes, user, generationDate);
        
        console.log(`Sending partial file: ${fileName}`);
        ws.send(JSON.stringify({
          type: 'PARTIAL_FILE_GENERATED',
          payload: { fileContents, fileName },
        }));
        generatedCodes = []; 
      }
    }

    if (generatedCodes.length > 0) {
      const fileName = `promo-codes-final-${generationDate.toISOString().split('T')[0]}.xlsx`;
      const fileContents = await createExcelFile(generatedCodes, user, generationDate);
      
      console.log('Generation complete. Sending final file to client.');
      ws.send(JSON.stringify({
        type: 'GENERATION_COMPLETE',
        payload: { fileContents, fileName },
      }));
    } else if (!isCancelledCheck()) {
      console.log('Generation finished with no new codes to send.');
      ws.send(JSON.stringify({ type: 'GENERATION_COMPLETE', payload: { fileContents: null } }));
    }

  } catch (error) {
    console.error('Stripe API Error:', error);
    ws.send(JSON.stringify({ type: 'ERROR', payload: { message: error.message } }));
  }
}

async function createExcelFile(codes, user, generationDate) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Promo Codes');

  worksheet.columns = [
    { header: 'Generated Promo Code', key: 'code', width: 30 },
    { header: 'Generation Date', key: 'date', width: 25 },
    { header: 'User', key: 'user', width: 20 },
  ];

  codes.forEach(code => {
    worksheet.addRow({
      code: code,
      date: generationDate,
      user: user,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer.toString('base64');
}

function generateRandomString(length) {
  return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
}

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server (HTTP + WebSocket) is running on port ${PORT}`);
  open(`http://localhost:${PORT}`);
});


// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  wss.close(() => {
    server.close(() => {
      console.log('Server shut down.');
      process.exit(0);
    });
  });
});
