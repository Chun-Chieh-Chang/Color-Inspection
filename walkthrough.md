# Color Inspection Tool - Updated Walkthrough (Client-Side Only)

This application is now a **Single-Page Application (SPA)** that runs directly in your browser. All image processing (OpenCV) is done locally.

## Prerequisite

- **Node.js** (for running the development server) or **http-server**.
- A modern web browser (Chrome, Edge, Firefox).

## How to Run

1.  Open Terminal in the project root: `c:\Users\3kids\Downloads\Color-Inspection`
2.  Navigate to `frontend`:
    ```bash
    cd frontend
    ```
3.  Install dependencies (if not already):
    ```bash
    npm install
    # Note: Only needed once.
    ```
4.  Start the development server:
    ```bash
    npm run dev
    ```
5.  Open your browser to the URL shown (usually `http://localhost:5173` or `5174`).

## How to Use

See [USAGE.md](USAGE.md) for detailed operational steps on Single-Image and Sequential workflows.

## Troubleshooting

- **"Camera Access Denied"**: Check browser permissions or switch to "Upload Image" mode.
- **"Loading Processing Engine..." stuck**: Ensure internet connection is available for the first run to download `opencv.js` (or download it locally and update `index.html`).
- **"Invalid ROI"**: Make sure you draw the boxes (Color Card, Standard, Test) before clicking Inspect.

## Comparison to Old Version

- **Old Version**: Required `uvicorn main:app` backend. (Deprecated)
- **New Version**: **No Python needed.** Just run the frontend.
