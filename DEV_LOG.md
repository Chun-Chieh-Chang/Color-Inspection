# Development Log & Retrospective

## Summary

Development of the "Color Inspection Tool" transitioned from a full-stack (Python/React) architecture to a client-side (OpenCV.js/React) architecture to simplify deployment and meet user requirements for a local, privacy-focused application.

## Challenges & Resolutions

### 1. Port Conflicts (Backend)

- **Issue**: The backend server (FastAPI) failed to start on standard ports `8000`, `8001`, `8080` due to existing system services or permission restrictions.
- **Root Cause**: Local development environment (Windows) had multiple services occupying common development ports.
- **Corrective Action**: Dynamic port selection strategy was used, eventually settling on a high-number port `54321`.
- **Lesson**: Always check for available ports before starting a service, or allow configuration via environment variables.

### 2. Frontend Build Failure (Tailwind CSS v4)

- **Issue**: `npm run dev` failed with `[postcss] It looks like you're trying to use tailwindcss directly as a PostCSS plugin`.
- **Root Cause**: The default `npm create vite` setup installed `tailwindcss` v4, but the configuration was set up for v3 (PostCSS plugin style), causing a version mismatch.
- **Corrective Action**:
  1.  Migrated configuration to use `@tailwindcss/vite` plugin (native Vite support).
  2.  Updated `index.css` to use `@import "tailwindcss";` instead of `@tailwind` directives.
  3.  Removed obsolete `postcss.config.js`.
- **Lesson**: When initializing new projects, verify major version changes in dependencies (Tailwind v4 was released recently) and follow the specific framework guide.

### 3. Browser Automation Environment Error

- **Issue**: The automated browser testing tool failed with `failed to install playwright: $HOME environment variable is not set`.
- **Root Cause**: The execution environment lacked the standard `$HOME` variable required by Playwright to install browser binaries.
- **Corrective Action**:
  1.  Relied on manual verification commands (`curl`, `python urllib`) to check server status.
  2.  Shifted to a Client-Side architecture which is robust enough to be verified by simply loading the static HTML file.
- **Lesson**: In constrained environments, favor simpler verification methods or static deployments that don't require heavy runtime dependencies.

### 4. Architecture Complexity & Privacy

- **Issue**: User feedback indicated the Client-Server architecture was too complex for a local tool and raised privacy concerns about data transmission.
- **Root Cause**: Initial over-engineering to support the Python requirement while delivering a Web UI.
- **Corrective Action**:
  1.  Refactored the core logic (Delta E, Calibration) from Python to JavaScript (OpenCV.js).
  2.  Removed the backend entirely.
  3.  Combined the codebase into a single Frontend project.
- **Lesson**: Always validate the deployment context first. For local tools without database needs, a static SPA (Single Page App) is superior.

## Future Recommendations

- **Testing**: Implement unit tests for the JS implementation of the color algorithms to ensure parity with the Python originals.
- **Performance**: If image resolution increases significantly (4K+), consider moving image processing to a Web Worker to avoid freezing the UI thread.

### 5. UI Layout & Terminology Refinement

- **Issue**:
  1.  "Workbench" header and "Reset All" button were partially obscured by the main image display area due to negative margins.
  2.  The term "Standard Product" was ambiguous and requested to be changed to "Golden Sample".
- **Resolution**:
  1.  Removed negative bottom margin (`mb-[-10px]`) and added positive spacing (`mb-2`) to the header row.
  2.  Updated all UI labels, button text, status messages, and confirmation dialogs to use "Golden Sample" consistency.
- **Outcome**: Improved visual clarity and localized terminology alignment.
