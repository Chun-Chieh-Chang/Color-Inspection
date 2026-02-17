/**
 * Client-Side Processing Engine
 * Handles calibration, Lab conversion, Delta E, and Transparency check.
 */

// Helper: Convert RGBA to RGB
function ensureRGB(mat) {
    if (mat.channels() === 4) {
        let rgb = new window.cv.Mat();
        window.cv.cvtColor(mat, rgb, window.cv.COLOR_RGBA2RGB);
        mat.delete();
        return rgb;
    }
    return mat;
}

export const ProcessingEngine = {
    calibrateImage: (srcMat, refRect) => {
        // refRect: {x, y, w, h}
        let roi = srcMat.roi(new window.cv.Rect(refRect.x, refRect.y, refRect.w, refRect.h));
        
        // Calculate Mean
        let mean = window.cv.mean(roi); // Returns [R, G, B, A]
        roi.delete();

        // Avoid zero division
        let avgR = Math.max(mean[0], 1e-5);
        let avgG = Math.max(mean[1], 1e-5);
        let avgB = Math.max(mean[2], 1e-5);

        // Target Grey (128)
        const target = 128.0;
        let gainR = target / avgR;
        let gainG = target / avgG;
        let gainB = target / avgB;

        // Apply Global Gain using multiply
        // We can do this with window.cv.transform or iterate or multiply scalar?
        // JS OpenCV mat manipulation is trickier than Python.
        // Let's use multiply with a scalar per channel? 
        // Or simpler: split channels, multiply, merge.
        
        let channels = new window.cv.MatVector();
        window.cv.split(srcMat, channels);
        
        let r = channels.get(0);
        let g = channels.get(1);
        let b = channels.get(2);
        
        // Multiply in-place? No, multiply returns dst.
        // Let's create scalars for multiplication: Wait, multiply(src, scalar) isn't straightforward in JS binding?
        // We can use convertScaleAbs with alpha = gain? Yes!
        // convertScaleAbs(src, dst, alpha, beta)
        
        r.convertTo(r, -1, gainR, 0);
        g.convertTo(g, -1, gainG, 0);
        b.convertTo(b, -1, gainB, 0);
        
        let merged = new window.cv.Mat();
        window.cv.merge(channels, merged);
        
        // Cleanup
        r.delete(); g.delete(); b.delete(); channels.delete();
        
        return merged;
    },

    /**
     * Calculates LAB Delta E
     * Returns { deltaE, labValues: [L, a, b] }
     */
    calculateDeltaE: (calibratedMat, goldenLab, roiRect) => {
        let roi = calibratedMat.roi(new window.cv.Rect(roiRect.x, roiRect.y, roiRect.w, roiRect.h));
        
        // Gaussian Blur
        let blurred = new window.cv.Mat();
        window.cv.GaussianBlur(roi, blurred, new window.cv.Size(5, 5), 0);
        roi.delete();

        // Convert to Lab
        let labMat = new window.cv.Mat();
        window.cv.cvtColor(blurred, labMat, window.cv.COLOR_RGB2Lab);
        blurred.delete();

        // Mean Lab
        let mean = window.cv.mean(labMat);
        labMat.delete();
        
        let L1 = mean[0];
        let a1 = mean[1];
        let b1 = mean[2];

        if (!goldenLab) {
            return { deltaE: 0, lab: [L1, a1, b1] };
        }

        let L2 = goldenLab[0];
        let a2 = goldenLab[1];
        let b2 = goldenLab[2];

        // Euclidean Distance
        let dL = L1 - L2;
        let da = a1 - a2;
        let db = b1 - b2;
        
        let deltaE = Math.sqrt(dL*dL + da*da + db*db);
        
        return { deltaE, lab: [L1, a1, b1] };
    },

    checkTransparency: (mat, blackRect, whiteRect) => {
        // Black ROI
        let rBlack = mat.roi(new window.cv.Rect(blackRect.x, blackRect.y, blackRect.w, blackRect.h));
        let grayBlack = new window.cv.Mat();
        window.cv.cvtColor(rBlack, grayBlack, window.cv.COLOR_RGB2GRAY);
        let meanBlack = window.cv.mean(grayBlack)[0];
        rBlack.delete(); grayBlack.delete();

        // White ROI
        let rWhite = mat.roi(new window.cv.Rect(whiteRect.x, whiteRect.y, whiteRect.w, whiteRect.h));
        let grayWhite = new window.cv.Mat();
        window.cv.cvtColor(rWhite, grayWhite, window.cv.COLOR_RGB2GRAY);
        let meanWhite = window.cv.mean(grayWhite)[0];
        rWhite.delete(); grayWhite.delete();

        // Contrast
        let contrast = (meanWhite - meanBlack) / (meanWhite + meanBlack + 1e-5);
        return contrast;
    }
};
