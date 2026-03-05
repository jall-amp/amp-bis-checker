# AMP BIS & Preorder Checker
> An advanced diagnostic Chrome Extension built exclusively for AMP Tier 2 Support Specialists.

![AMP BIS Checker](icon.png)

## Overview
The AMP BIS (Back in Stock) & Preorder Checker is a proprietary troubleshooting tool. It drastically reduces manual diagnostic effort by instantly inspecting active Shopify web pages, surfacing hidden rendering issues, injecting debugging tools, and streamlining theme-level troubleshooting—all without requiring direct backend codebase access.

## Installation

### First Time Setup
1. Clone this repository or download the ZIP file and extract it.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. In the top right corner, toggle **Developer mode** to ON.
4. Click the **Load unpacked** button in the top left.
5. Select the `bischecker` project directory.
6. Click the puzzle-piece icon in your Chrome toolbar and 'pin' the extension for easy access.

### Updating the Extension
1. Pull the latest changes from the `main` branch.
2. Go to `chrome://extensions/`.
3. Locate the "AMP BIS CHECKER" card.
4. Click the **reload** icon (the circular arrow) on the extension card to refresh the local code.

---

## Tool Functions & Tier 2 Workflows

### 1. Check Current Page
Automates the discovery of Back in Stock (BIS) installation assets on the active merchant page.
- **Scans DOM for:** The JS widget (`backinstock.useamp.com/widget/*.js`), ID triggers (`#BIS_trigger`), and Class triggers (`.BIS_trigger`).
- **Visibility Detection:** Crucially detects if a trigger button is present but invisible due to conflicting theme CSS (e.g., `display: none`). Flags the instance with a ⚠️ **Hidden (CSS)** warning.
- **Go to Element:** Forces hidden buttons (and parent containers) to become visible, scrolls to the targeted element, and highlights it with a green flashing border.

### 2. Open / Close BIS Editor
Injects the powerful BIS Admin Copy Widget directly into a Shopify product page context for unlinked/custom themes.
- Disables backend reliance by creating an interactive configuration panel on the storefront.
- Visually configure Element types (`<button>` vs `<a>`), Anchor Positions, and Custom CSS classes/styles.
- Simply click "Copy Script" within the payload to grab the finalised Integration Script.

### 3. Inject Script
Manually inject an external script URL directly into the `<head>` of the loaded DOM.
- Essential for testing custom integration widgets or beta builds provided by Tier 3 without modifying the merchant's live theme code.

### 4. Copy V1 Collection Snippet
One-click copy of the standard Liquid HTML block required to render BIS "Email when available" buttons directly over product grids or collection pages.

### 5. Check Preorder Product
Fetches the live `.js` JSON endpoint of the active Shopify product page and cross-references it with proprietary Pre-order configuration states.
- Diagnoses why a "Pre-order Now" button might fail to render.
- Validates the `continue` selling when out-of-stock policies.
- **Note on "Unknown (Hidden by Theme)":** If the storefront theme redacts the exact `inventory_quantity` from the public JSON, and the BIS backend doesn't flag it as out-of-stock (`oos`), the extension flags the stock as unknown, indicating you must check the Shopify Admin manually.

---

## Security & Privacy
This extension operates entirely client-side. It does not store, request, or embed any private API credentials. It uniquely parses public DOM interactions and standardized Shopify front-end JSON architecture.

## Support and Modification
* Built entirely in HTML, CSS, and Vanilla JavaScript. 
* Managed via internal GitHub.
* If Shopify pushes an architecture change that breaks functionality, please open an Issue in the internal repository for prompt patching by the maintaining Tier 2 tools team.
