# 🔍 AMP BIS & Preorder Checker

> An advanced diagnostic Chrome Extension built exclusively for AMP Tier 2 Support Specialists.

![AMP BIS Checker](icon.png)

---

## Overview

The **AMP BIS (Back in Stock) & Preorder Checker** is a proprietary troubleshooting tool designed for the AMP support team. It eliminates hours of manual detective work by instantly inspecting Shopify storefronts, surfacing hidden rendering issues, and diagnosing exactly why BIS or Preorder buttons do or don't appear — all without requiring backend access.

---

## 📦 Installation

### First Time Setup
1. Clone this repository or download the ZIP and extract it.
2. Open Google Chrome → navigate to `chrome://extensions/`.
3. Toggle **Developer mode** ON (top right corner).
4. Click **Load unpacked** (top left).
5. Select the `bischecker` project folder.
6. Click the puzzle-piece icon in your toolbar and **pin** the extension for quick access.

### Updating the Extension
1. Pull the latest changes from `main`.
2. Go to `chrome://extensions/`.
3. Find **"AMP BIS CHECKER"** and click the **↻ reload** icon on its card.

---

## 🛠️ Features

The extension is split into two main sections: **AMP BIS Checker** and **AMP Preorder Checker**.

---

### 1. ✅ Check Scripts & Elements

> **What it does:** Scans the active page for BIS installation assets.

| What It Checks | Details |
|---|---|
| **BIS Script** | Looks for `<script>` tags loading from `backinstock.useamp.com/widget/*.js` |
| **#BIS_trigger (ID)** | Checks if a `#BIS_trigger` element exists in the DOM |
| **.BIS_trigger (Class)** | Checks if a `.BIS_trigger` element exists in the DOM |

**Status indicators:**
- 🟢 **Found** — Element is present and visible
- 🟡 **Hidden (CSS)** — Element exists but is invisible (e.g., `display: none`, `visibility: hidden`, or `opacity: 0`). This is a common cause of "button doesn't show" tickets.
- 🔴 **Not Found** — Element does not exist on the page

**Go to Element** button: Forces hidden elements visible, scrolls to them, and highlights them with a flashing green border.

---

### 2. 🔎 Check BIS Product

> **What it does:** Analyzes whether the BIS "Notify Me" button should appear for each variant on a product page.

**Must be on a Shopify product page** (`/products/...`).

#### Data Sources (in priority order)
The extension pulls variant data from multiple sources to ensure accuracy, even when themes hide inventory fields:

1. **BIS.Config.product.variants** — The BIS widget's own data (only contains variants where Continue Selling is OFF)
2. **LiquidPreOrdersConfig.variants** — The preorder config (contains ALL variants with accurate `oos` and `inventory_policy`)
3. **Product JSON** (`.js` endpoint) — The theme's public product data (may have fields stripped)

#### What It Shows Per Variant

| Field | Green (✅ Good for BIS) | Red (❌ Bad for BIS) |
|---|---|---|
| **Stock** | `OOS` — Variant is out of stock | `In Stock` — Variant is available |
| **Inventory Tracking** | `True` — Tracked by Shopify | `False` — Not tracked |
| **Continue Selling When OOS** | `False` — Customers can't buy when OOS | `True` — Customers can still buy |
| **Hidden by tag** | `None` — No exclusion tags found | `tag-name` — Matched a tag in `hide_for_product_tags` |

#### Verdict
- ✅ **BIS button should be visible** — All 4 conditions are met
- ❌ **BIS button will NOT show** — Lists specific reasons, e.g.:
  > *Reasons: Product is in stock. 'Continue Selling When OOS' is true.*

#### Understanding the Logic
For the BIS button to appear, **ALL** of these must be true:
1. The variant must be **out of stock** (qty ≤ 0 or `available: false`)
2. **Inventory tracking** must be enabled (`inventory_management: "shopify"`)
3. **Continue selling when OOS** must be **OFF** (`inventory_policy: "deny"`) — If it's ON, customers can still buy, so there's no need for a "back in stock" notification
4. The product must **not have an exclusion tag** matching `hide_for_product_tags` in BIS settings (default: `bis-hidden`)

#### Go to Variant
Each variant card has a **"Go to variant"** button that navigates the page to that specific variant by appending `?variant=ID` to the URL.

#### BIS Settings
At the bottom, a collapsible section shows the full `BIS.Config` object — all global/app-level settings like `app_hostname`, `hide_for_product_tags`, button styling, etc. Long values are truncated to 100 characters with a **"Show All"** popup for the full content.

---

### 3. 🖊️ Open BIS Editor

> **What it does:** Injects the BIS Admin Copy Widget directly into the page.

- Creates an interactive configuration panel on the storefront without backend access
- Configure element types (`<button>` vs `<a>`), anchor positions, CSS classes/styles
- Click **"Copy Script"** to grab the finalized integration script
- Click **"Close BIS Editor"** to remove it

---

### 4. 💉 Inject Script

> **What it does:** Manually inject an external script URL into the page's `<head>`.

- Paste any BIS widget URL into the input field and click **Inject Script**
- Essential for testing custom integration widgets or beta builds from Tier 3 without modifying the merchant's live theme
- The script runs immediately in the page context

---

### 5. 📋 Copy V1 Collection Snippet

> **What it does:** One-click copy of the standard Liquid HTML block for collection pages.

Copies the snippet needed to render BIS "Email when available" buttons on product grids and collection pages directly to your clipboard.

---

### 6. 🛒 Check Preorder Product

> **What it does:** Analyzes whether the Preorder button should appear for each variant.

**Must be on a Shopify product page** (`/products/...`).

#### Data Sources
- **Product JSON** (`.js` endpoint) — Variant inventory data
- **LiquidPreOrdersConfig** — Accurate `oos` and `inventory_policy` from BIS backend
- **AppPreOrdersConfig** — App-level preorder settings

#### What It Shows Per Variant

| Field | Details |
|---|---|
| **Stock** | `OOS` (green) / Stock count or `In Stock` (red) / `Unknown (Hidden by Theme)` (amber) |
| **Continue Selling When OOS** | `True` (green — required for preorder) / `False` (red) / `Unknown` |
| **App Embed** | Whether the Preorder app block is active in the theme |
| **Visibility Setting** | `all` / `tagged` — controls which products get the preorder button |
| **Preorder Tag** | Shows if the product has the `preorder-enabled` tag (relevant when visibility = `tagged`) |

#### Verdict
- ✅ **Preorder button should show** — All conditions met
- ❌ **Preorder button will NOT show** — Lists specific reasons

#### Understanding the Logic
For preorder to show, the variant must be:
1. **Out of stock** (qty ≤ 0)
2. **Continue selling when OOS = ON** (`inventory_policy: "continue"`) — opposite of BIS!
3. **App embed active** in the theme
4. **Visibility setting** allows it (either `all` products, or `tagged` with the correct tag)

> **Key difference from BIS:** Preorder requires `Continue Selling = True` (so customers CAN buy), while BIS requires `Continue Selling = False` (so customers NEED to be notified). They are mutually exclusive by design.

---

## 🔐 Security & Privacy

- Operates **entirely client-side** — no data is sent to external servers
- Does **not** store, request, or embed any private API credentials
- Only reads public DOM content and Shopify's standard front-end JSON architecture
- Permissions are limited to `activeTab` and `scripting` (no background data collection)

---

## 🧱 Tech Stack

| Component | Technology |
|---|---|
| UI | HTML + CSS |
| Logic | Vanilla JavaScript |
| Platform | Chrome Extension (Manifest V3) |
| APIs Used | `chrome.tabs`, `chrome.scripting` |

---

## 🐛 Troubleshooting

| Issue | Solution |
|---|---|
| Extension doesn't load | Make sure **Developer mode** is ON in `chrome://extensions/` |
| "Cannot run on this page" | Navigate to an `http://` or `https://` page first |
| "Please navigate to a Shopify product page" | You must be on a `/products/...` URL for product checks |
| BIS Settings section is empty | The store may not have the BIS widget installed, or it hasn't loaded yet |
| Data shows "Unknown" or "Hidden by Theme" | The theme is stripping inventory fields from the JSON — the extension will fall back to BIS.Config or LiquidPreOrdersConfig if available |

---

## 📝 Changelog

### v1.3 — March 2026
- ✨ Added **Check BIS Product** with full variant analysis
- 🔗 Added **LiquidPreOrdersConfig** as a data source for accurate inventory data
- 🏷️ Added **tag-based exclusion detection** (`hide_for_product_tags`)
- 🚀 Added **"Go to variant"** buttons
- 📦 "Default Title" → "Single Product" for single-variant products
- 📋 BIS Settings section with truncated values + "Show All" modal

### v1.2 — March 2026
- ✨ Added **Check Preorder Product** with App Embed detection
- 🔄 Renamed "Check Current Page" to "Check Scripts & Elements"

### v1.1 — March 2026
- ✨ Added **Check Scripts & Elements** diagnostic tool
- 🖊️ Added **BIS Editor** injection
- 💉 Added **Script Injector**
- 📋 Added **V1 Collection Snippet** copy

### v1.0 — Initial Release
- 🚀 Basic extension structure

---

## 🤝 Contributing

Built and maintained by the AMP Tier 2 tools team. If Shopify pushes an architecture change that breaks functionality, please open an **Issue** in the internal repository for prompt patching.
