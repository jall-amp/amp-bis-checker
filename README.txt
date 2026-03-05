AMP BIS CHECKER - Installation and Usage Guide

The AMP BIS CHECKER is a Chrome extension designed to assist Tier 2 Support Specialists in rapidly debugging, verifying, and configuring "Back in Stock" (BIS) integrations on Shopify storefronts.

----------------------------------------------------
HOW TO INSTALL OR UPDATE
----------------------------------------------------

If installing for the FIRST TIME:
1. Download and extract the provided .zip file. You should have an unzipped folder called 'bischecker'.
2. Open Google Chrome and go to: chrome://extensions/
3. In the top right corner, turn ON "Developer mode".
4. Click the "Load unpacked" button in the top left.
5. Select the extracted 'bischecker' folder.
6. Click the puzzle-piece icon in your Chrome toolbar and 'pin' the AMP BIS CHECKER.

If UPDATING from an older version:
*Do not install both at the same time!*
1. Go to chrome://extensions/
2. Find the old "BIS Checker by Jall" or "AMP BIS CHECKER" card.
3. Click "Remove" to delete the old version completely.
4. Follow the FIRST TIME installation steps above using the newest unzipped folder.

----------------------------------------------------
FEATURES & TOOLS
----------------------------------------------------

1. Check Current Page
This tool scans the active web page's source code for the Back in Stock JavaScript widget, hidden #BIS_trigger IDs, and .BIS_trigger classes. 
It helps identify if elements exist but are being hidden by the theme's CSS (like display: none). Click "Go to Element" to force hidden buttons to become visible and flash green, making them easy to find.

2. Open/Close BIS Editor - BIS Admin Copy Script
This injects the comprehensive configuration script directly into the active Shopify product page. Must be used on a URL containing /products/.
It opens a dark-mode panel on the left side of your screen where you can interactively edit and configure a product page's BIS button appearance, layout styles, and custom CSS classes. You can cleanly toggle the editor On or Off by clicking the button again.

3. Copy V1 Collection Snippet
This button instantly copies the standard HTML/Liquid snippet required for injecting Back in Stock notifications on Collection pages directly to your computer's clipboard. Just click the button, wait for the "Copied!" confirmation, and paste it into the necessary grid file.
