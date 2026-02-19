# Color Inspection Tool (Web Version)

A client-side web application for inspecting color differences (Delta E) and material transparency using computer vision techniques directly in the browser.

## Features

- **Color Inspection**: Calculate Delta E (CIE76/2000) between a "Golden Sample" and a "Test Product".
- **Transparency Check**: Analyze material transparency by comparing contrast over Black/White backgrounds.
- **Automatic Calibration**: Use a reference White Card to calibrate white balance before inspection.
- **Interactive UI**:
  - **Area Zoom**: Draw a box to zoom into specific details.
  - **5-Point ROI**: Easily select Calibration, Golden Sample, Test Product, Black Background, and White Background regions.
  - **Golden Sample Locking**: Save the standard reference values to inspect multiple test products efficiently.
- **Privacy First**: All processing happens locally in your browser using OpenCV.js; no images are uploaded to any server.

## Usage

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-repo/color-inspection.git
    cd color-inspection/frontend
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Run locally**:
    ```bash
    npm run dev
    ```
4.  **Build for production**:
    ```bash
    npm run build
    ```
    The output will be in the `dist` folder, ready to be deployed to GitHub Pages or any static host.

## Tech Stack

- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4
- **Computer Vision**: OpenCV.js (WASM)
- **Deployment**: GitHub Pages (via Actions)
