# Gouda Chatbot Project

This repository contains the source code for the Gouda Chatbot, designed to provide information about activities and rehabilitation facilities in Gouda, Netherlands. The project consists of a Python/Flask backend API that interacts with OpenAI's Assistants API for chat and retrieval functionalities, and a React frontend.

## Project Structure

```
.
├── gouda-chatbot-frontend/   # React frontend application
│   ├── public/
│   ├── src/
│   ├── .env.example          # Example environment variables for frontend
│   ├── package.json
│   └── ...
├── GoudaChatBotApiV2/           # Python Flask backend API (or your chosen folder name)
│   ├── Controllers/
│   │   └── chat_controller.py
│   ├── Services/
│   │   └── chat_service.py
│   ├── Data/                 # Contains .txt files for OpenAI Retrieval
│   │   ├── alle_organisaties.txt
│   │   └── ...
│   ├── Helpers/
│   │   └── csv_to_txt.py     # Converts recieved .csv data from the Webscraping team to .txt for Retrieval
│   ├── UnitTests/
│   │   └── cache_manager.py
│   ├── Utils/
│   │   └── test_chat_service.py
│   ├── main.py               # Main Flask application file
│   ├── requirements.txt      # Python dependencies
│   ├── instructions.txt      # Default instructions for the OpenAI Assistant
│   ├── .env.example          # Example environment variables for backend
│   └── .gitignore            # Specific to backend if needed
├── .gitignore                # Root .gitignore for the whole repository
└── README.md                 # This file
```

## Prerequisites

Before you begin, ensure you have the following installed:

*   **Python:** Version 3.12 or higher.
*   **pip:** Python package installer (usually comes with Python).
*   **Node.js & npm:** For the React frontend (LTS version recommended).
*   **Git:** For version control.
*   **An OpenAI API Key:** Required to interact with OpenAI services.
*   **(Optional but Recommended) A code editor:** e.g., Visual Studio Code.

## Local Setup Instructions

Follow these steps to get the Gouda Chatbot running on your local machine.

### 1. Clone the Repository

```bash
git clone <repository_url>
cd <repository_folder_name>
```

### 2. Backend Setup (Python/Flask)

1.  **Navigate to the Backend Directory:**
    ```bash
    cd python-backend  # Or your backend folder name
    ```

2.  **Create and Activate a Virtual Environment (Recommended):**
    ```bash
    # Create virtual environment
    python -m venv .venv

    # Activate virtual environment
    # Windows:
    # .venv\Scripts\activate
    # macOS/Linux:
    # source .venv/bin/activate
    ```

3.  **Install Python Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure Backend Environment Variables:**
    *   Create a file named `.env` in the root of your `python-backend` directory.
    *   Copy the contents from `.env.example` (if provided) or add the following, replacing the placeholder values:
        ```env
        # python-backend/.env
        OPENAI_API_KEY="sk-YourActualOpenAIKey"
        VECTOR_STORE_ID="vs_YourPreconfiguredVectorStoreID" # See note below
        ALLOWED_ORIGINS="http://localhost:5173" # Default Vite/React dev server port
        ```
    *   **Note on `VECTOR_STORE_ID`:**
        *   The application uses OpenAI's Assistants API with a Vector Store for retrieval. This Vector Store needs to be created **once** in your OpenAI account and populated with the files from the `Data/` directory.
        *   To do this:
            1.  Manually upload the `.txt` files from the `Data/` folder to your OpenAI account (Files section).
            2.  Create a Vector Store via the OpenAI dashboard or API, and add these uploaded file IDs to it.
            3.  Get the ID of this Vector Store and put it in your `.env` file as `VECTOR_STORE_ID`.
        *   The `main.py` file currently does *not* automatically create the Vector Store or upload files on startup; this is assumed to be a one-time setup. The `_get_or_create_assistant()` function in `chat_service.py` will attempt to create an Assistant linked to this `VECTOR_STORE_ID`.

5.  **Prepare `instructions.txt`:**
    *   Ensure the `instructions.txt` file exists in the root of the `python-backend` directory. This file contains the primary instructions for the OpenAI Assistant.

6.  **Run the Backend Development Server:**
    ```bash
    python main.py
    ```
    The backend API should now be running, typically on `http://127.0.0.1:5227`. Check the console output for the exact address and any error messages.

### 3. Frontend Setup (React/Vite)

1.  **Navigate to the Frontend Directory:**
    ```bash
    # From the repository root
    cd gouda-chatbot-frontend
    ```

2.  **Install Node.js Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Frontend Environment Variables:**
    *   Create a file named `.env` in the root of your `gouda-chatbot-frontend` directory.
    *   Copy the contents from `.env.example` (if provided) or add the following, ensuring it points to your locally running backend:
        ```env
        # gouda-chatbot-frontend/.env
        VITE_API_BASE_URL=http://localhost:5227
        ```

4.  **Run the Frontend Development Server:**
    ```bash
    npm run dev
    ```
    The React frontend should now be accessible in your browser, typically at `http://localhost:5173`.

### 4. Using the Chatbot

*   Open your browser and navigate to the frontend URL (e.g., `http://localhost:5173`).
*   You should be able to interact with the chatbot. The frontend will make API calls to your local backend, which in turn communicates with OpenAI.

## Key Configuration Points

*   **OpenAI API Key (`OPENAI_API_KEY`):** Essential for all OpenAI interactions. Keep this secret and never commit it to Git.
*   **Vector Store ID (`VECTOR_STORE_ID`):** Required for the backend to link the Assistant to your custom data for retrieval. This needs to be pre-configured in your OpenAI account.
*   **Allowed Origins (`ALLOWED_ORIGINS`):** Configures CORS for the backend, allowing the specified frontend URLs to make requests.
*   **Frontend API Base URL (`VITE_API_BASE_URL`):** Tells the React app where to find the backend API.
*   **`instructions.txt`:** Contains the main system prompt/instructions for the OpenAI Assistant.
*   **`Data/` folder:** Contains the `.txt` files that should be uploaded to your OpenAI Vector Store for retrieval.

## Deployment to Azure (Brief Overview)

This project is designed to be deployed with:

1.  **Backend (Python/Flask):** Deployed to **Azure App Service (Linux, F1 Free Tier or higher)**.
    *   Uses a startup command like: `python -m gunicorn --worker-class gevent --bind=0.0.0.0 --timeout 600 main:app` (or with `pip install` prepended if dependencies aren't reliably installed by the deployment build).
    *   Environment variables (`OPENAI_API_KEY`, `VECTOR_STORE_ID`, `ALLOWED_ORIGINS`) are set in the App Service Configuration.
2.  **Frontend (React/Vite):** Deployed to **Azure Static Web Apps (Standard Plan)**.
    *   Build is handled by GitHub Actions.
    *   `VITE_API_BASE_URL` in the committed `.env` (or build configuration) should be empty or `/` for production.
    *   The Static Web App is configured to proxy requests to `/api/*` to the backend App Service URL.

Refer to the detailed deployment guides discussed previously for step-by-step Azure setup.

## Troubleshooting Local Setup

*   **Module Not Found (Python):** Ensure your virtual environment is activated and you've run `pip install -r requirements.txt`.
*   **Connection Refused (Frontend to Backend):** Verify both backend and frontend servers are running and the `VITE_API_BASE_URL` in the frontend's `.env` correctly points to the backend's address and port. Check CORS settings in the backend if direct calls fail.
*   **OpenAI API Errors:** Double-check your `OPENAI_API_KEY` is correct and active. Check the backend console for specific error messages from the OpenAI library. Ensure your `VECTOR_STORE_ID` is valid and linked to the files intended for retrieval.
*   **File Not Found (`instructions.txt`, Data files):** Ensure these files are in the correct locations relative to your Python scripts.
