# Project Overview

This project is a full-stack application designed to generate Stripe promotion codes. It consists of two main parts: a client-side React application and a Node.js server.

*   **Client:** A React application bootstrapped with Create React App, responsible for the user interface and interacting with the backend.
*   **Server:** A Node.js application using Express and WebSockets. It handles the logic for generating Stripe promotion codes via the Stripe API and communicates progress and results back to the client.

# Building and Running

This project has separate instructions for the client and server components.

## Client (React App)

The client-side application is a standard Create React App setup.

*   **Dependencies:** Node.js and npm/yarn.
*   **Installation:**
    ```bash
    cd client
    npm install
    ```
*   **Running in Development Mode:**
    ```bash
    npm start
    ```
    This will run the app in development mode and open it in your browser at `http://localhost:3000`.
*   **Building for Production:**
    ```bash
    npm run build
    ```
    This command builds the app for production to the `build` folder.
*   **Running Tests:**
    ```bash
    npm test
    ```
    Launches the test runner in interactive watch mode.

## Server (Node.js)

The server-side application is a Node.js Express application with WebSocket capabilities.

*   **Dependencies:** Node.js and npm/yarn.
*   **Environment Variables:** Requires a `.env` file in the `server` directory with `STRIPE_SECRET_KEY` and `PORT` (e.g., `PORT=5001`).
*   **Installation:**
    ```bash
    cd server
    npm install
    ```
*   **Running the Server:**
    ```bash
    node index.js
    ```
    This will start the server, which will listen for HTTP and WebSocket connections on the configured port (defaulting to 5001).

# Development Conventions

*   **Client:** Follows standard React best practices and conventions as provided by Create React App.
*   **Server:** Uses Node.js with Express for routing and `ws` for WebSocket communication. Stripe API interactions are handled directly on the server.
