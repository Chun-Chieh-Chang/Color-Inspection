# Color Inspection Tool - User Guide

This tool runs entirely in your browser using **OpenCV.js**. No backend or installation is required.
Just launch `npm run dev` in the `frontend` folder and visit `http://localhost:5174`.

## Features

- **Client-Side Processing**: Fast, private, no data leaves your computer.
- **Delta E Analysis**: Professional color difference measurement (CIELAB).
- **Flexible Workflows**: Supports both single-image and multi-image inspection.

---

## Workflow 1: Single Image Inspection

Use this when you have a photo containing **all three items**:

1.  **Color Card** (for calibration)
2.  **Standard Product** (the target)
3.  **Test Product** (the sample)

**Steps:**

1.  Click **"Load New Image"** and select your photo.
2.  In "Step 2: Draw Regions", click **"1. Color Card"** and draw a box around the color card.
3.  Click **"2. Standard"** and draw a box around the standard product.
4.  Click **"3. Test Product"** and draw a box around the test product.
5.  Click **"INSPECT"**.
6.  View the Pass/Fail result and Delta E value.

---

## Workflow 2: Sequential Inspection (Fixed Setup)

Use this when you have:

- **One Standard Image** (or physical setup with standard item).
- **Multiple Test Images** (taken under same lighting/camera conditions).

**Steps:**

1.  **Setup Standard:**
    - Load the image containing the **Color Card** and **Standard Product**.
    - Draw ROI for **Color Card** and **Standard Product**.
    - Click **"🔒 Lock Standard"**.
    - _The system now remembers the Standard Color values._

2.  **Inspect Test Samples:**
    - Load a new image containing the **Color Card** and **Test Product**.
    - Draw ROI for **Color Card** (re-calibration is required for every new image to correct slight lighting shifts).
    - Draw ROI for **Test Product**.
    - _(Note: ROI positions are remembered! If camera didn't move, you might not even need to redraw.)_
    - Click **"INSPECT"**.

3.  To change the standard, click **"🔓 Unlock / Reset"**.

---

## Troubleshooting

- **"Loading Processing Engine..."**: Wait a few seconds for OpenCV.js to download/initialize.
- **"Invalid ROI"**: Ensure you draw boxes with valid width/height.
- **Camera Access**: Allow browser permission if using webcam.
