function showError(message) {
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.textContent = message;
  errorMsg.classList.remove('hidden');
  setTimeout(() => {
    errorMsg.classList.add('hidden');
  }, 5000);
}

function showPreorderError(message) {
  const errorMsg = document.getElementById('errorMsgPreorder');
  errorMsg.textContent = message;
  errorMsg.classList.remove('hidden');
  setTimeout(() => {
    errorMsg.classList.add('hidden');
  }, 5000);
}

document.getElementById('checkBtn').addEventListener('click', async () => {
  // Reset UI
  resetStatus('scriptStatus', 'scriptDetails');
  resetStatus('idStatus', 'idDetails');
  resetStatus('classStatus', 'classDetails');

  // Get the active tab
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.startsWith('http')) {
    showError('Cannot run on this page.');
    return;
  }

  // Execute the checking function
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: checkBISInstallation,
  }, (results) => {
    if (results && results[0] && results[0].result) {
      const data = results[0].result;

      updateStatus('scriptStatus', 'scriptDetails', data.scripts, 'script', tab.id);
      updateStatus('idStatus', 'idDetails', data.ids, 'id', tab.id);
      updateStatus('classStatus', 'classDetails', data.classes, 'class', tab.id);
    }
  });
});

function resetStatus(btnId, detailsId) {
  const btn = document.getElementById(btnId);
  btn.textContent = 'Checking...';
  btn.className = 'status-btn unknown';
  btn.disabled = true;

  const detailsDiv = document.getElementById(detailsId);
  detailsDiv.innerHTML = '';
  detailsDiv.classList.add('hidden');
}

function updateStatus(btnId, detailsId, itemsArray, typeIdentifier, tabId) {
  const btn = document.getElementById(btnId);
  const detailsDiv = document.getElementById(detailsId);

  if (itemsArray && itemsArray.length > 0) {
    btn.textContent = `Found (${itemsArray.length})`;
    btn.className = 'status-btn success clickable';
    btn.disabled = false;

    // Build the dynamic list of textareas
    itemsArray.forEach((item, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'item-wrapper';

      const header = document.createElement('div');
      header.className = 'item-header';

      // Determine if there's a visibility issue (ignore for script tags)
      if (typeIdentifier !== 'script' && !item.isVisible) {
        header.innerHTML = `Instance ${index + 1}: <span class="warning-tag">⚠️ Hidden (CSS)</span>`;
        wrapper.classList.add('warning-border');
      } else {
        header.textContent = `Instance ${index + 1}:`;
      }

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'action-buttons';

      const textarea = document.createElement('textarea');
      textarea.readOnly = true;
      textarea.value = item.html;

      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.onclick = () => {
        textarea.select();
        navigator.clipboard.writeText(textarea.value).then(() => {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = originalText; }, 1500);
        });
      };

      const highlightBtn = document.createElement('button');
      highlightBtn.className = 'highlight-btn';
      highlightBtn.textContent = 'Go to Element';
      highlightBtn.onclick = () => {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: highlightElementInDom,
          args: [typeIdentifier, index]
        });
      };

      actionsDiv.appendChild(highlightBtn);
      actionsDiv.appendChild(copyBtn);

      wrapper.appendChild(header);
      wrapper.appendChild(textarea);
      wrapper.appendChild(actionsDiv);
      detailsDiv.appendChild(wrapper);
    });

    // Setup toggle
    btn.onclick = () => {
      detailsDiv.classList.toggle('hidden');
    };
  } else {
    btn.textContent = 'Not Found';
    btn.className = 'status-btn error';
    btn.disabled = true;
  }
}

// ----------------------------------------------------
// Functions that run dynamically in the Active Tab
// ----------------------------------------------------

function checkBISInstallation() {
  // Helper function to check if an element is actually visible on screen
  function isElementVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && el.offsetWidth > 0 && el.offsetHeight > 0;
  }

  // 1. Check for the BIS Javascript Widget
  const scriptTags = document.querySelectorAll('script');
  const scripts = [];
  for (let script of scriptTags) {
    if (script.src && script.src.includes('backinstock.useamp.com/widget/') && script.src.includes('.js')) {
      // Scripts don't have visual visibility
      scripts.push({ html: script.outerHTML, isVisible: true });
    }
  }

  // 2. Check for the ID trigger
  const idTags = document.querySelectorAll('#BIS_trigger');
  const ids = Array.from(idTags).map(el => ({
    html: el.outerHTML,
    isVisible: isElementVisible(el)
  }));

  // 3. Check for the Class trigger
  const classTags = document.querySelectorAll('.BIS_trigger');
  const classes = Array.from(classTags).map(el => ({
    html: el.outerHTML,
    isVisible: isElementVisible(el)
  }));

  return {
    scripts,
    ids,
    classes
  };
}

function highlightElementInDom(type, index) {
  let elementArray = [];

  if (type === 'script') {
    const scripts = document.querySelectorAll('script');
    for (let s of scripts) {
      if (s.src && s.src.includes('backinstock.useamp.com/widget/') && s.src.includes('.js')) {
        elementArray.push(s);
      }
    }
  } else if (type === 'id') {
    elementArray = document.querySelectorAll('#BIS_trigger');
  } else if (type === 'class') {
    elementArray = document.querySelectorAll('.BIS_trigger');
  }

  const targetEl = elementArray[index];

  if (targetEl) {
    // We need to bypass display:none, visibility:hidden, and opacity:0
    // Additionally, if a parent element is hiding it, we must unhide the parents temporarily.
    const hiddenAncestors = [];
    let current = targetEl;

    while (current && current !== document.body && current !== document.documentElement) {
      const compStyle = window.getComputedStyle(current);
      if (compStyle.display === 'none' || compStyle.visibility === 'hidden' || compStyle.opacity === '0') {
        hiddenAncestors.push({
          el: current,
          display: current.style.display,
          visibility: current.style.visibility,
          opacity: current.style.opacity
        });
        current.style.setProperty('display', 'block', 'important');
        current.style.setProperty('visibility', 'visible', 'important');
        current.style.setProperty('opacity', '1', 'important');
      }
      current = current.parentElement;
    }

    if (hiddenAncestors.length > 0) {
      console.warn('[BIS Checker] Force-showing element and/or its hidden parents.');
    }

    // Scroll into view smoothly
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Create a highlight flash effect
    const originalOutline = targetEl.style.outline;
    const originalBoxShadow = targetEl.style.boxShadow;
    const originalTransition = targetEl.style.transition;

    targetEl.style.transition = 'all 0.3s ease';
    targetEl.style.outline = '4px solid #008060';
    targetEl.style.boxShadow = '0 0 15px rgba(0, 128, 96, 0.8)';

    // Log for DevTools
    console.log(`[BIS Checker] Highlighted Instance ${index + 1}:`, targetEl);

    setTimeout(() => {
      // Revert highlight
      targetEl.style.outline = originalOutline;
      targetEl.style.boxShadow = originalBoxShadow;
      targetEl.style.transition = originalTransition;

      // Revert all hidden ancestors
      hiddenAncestors.forEach(ancestor => {
        ancestor.el.style.display = ancestor.display;
        ancestor.el.style.visibility = ancestor.visibility;
        ancestor.el.style.opacity = ancestor.opacity;
      });
    }, 3000);
  } else {
    console.warn('[BIS Checker] Element could not be found for highlighting.');
  }
}

// ----------------------------------------------------
// New: Open BIS Editor Functionality
// ----------------------------------------------------

// Check Editor status on Popup load
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (tab && tab.url && tab.url.includes('/products/')) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      function: () => !!document.getElementById('bist'),
    }, (results) => {
      if (results && results[0] && results[0].result) {
        document.getElementById('openEditorBtn').textContent = 'Close BIS Editor';
      }
    });
  }
});

document.getElementById('openEditorBtn').addEventListener('click', async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.startsWith('http')) {
    showError('Cannot run on this page.');
    return;
  }

  // Check if it's likely a product page
  if (!tab.url.includes('/products/')) {
    showError('Please navigate to a Shopify product page to use the BIS Editor.');
    return;
  }

  const btn = document.getElementById('openEditorBtn');
  const isClosing = btn.textContent === 'Close BIS Editor';

  if (isClosing) {
    // Remove BIS Editor from tab context
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      function: () => {
        const bistPanel = document.getElementById('bist');
        const actionsMenu = document.getElementById('bist-actions-menu');
        const copyTextarea = document.getElementById('bist-copy-textarea');

        if (bistPanel) bistPanel.remove();
        if (actionsMenu) actionsMenu.remove();
        if (copyTextarea) copyTextarea.remove();
      }
    });
    btn.textContent = 'Open BIS Editor';
  } else {
    // Execute the BIS Editor script in the active tab context
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      function: openBisEditor,
    });
    btn.textContent = 'Close BIS Editor';
  }
});

document.getElementById('copyCollectionsBtn').addEventListener('click', async () => {
  const liquidSnippet = `<!-- Inserted by Back in Stock -->
{% unless card_product.available %}
  <a href="#" class="BIS_trigger bis-collection-button button" style="text-decoration: none" data-product-data="{{ card_product | json | escape }}">
    Email when available
  </a>
{% endunless %}
<!-- End of the block inserted by Back in Stock -->`;

  try {
    await navigator.clipboard.writeText(liquidSnippet);
    const btn = document.getElementById('copyCollectionsBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 1500);
  } catch (err) {
    showError('Failed to copy text. Please try again.');
    console.error('Clipboard write failed:', err);
  }
});

document.getElementById('injectScriptBtn').addEventListener('click', async () => {
  const urlInput = document.getElementById('injectScriptUrl').value.trim();

  if (!urlInput || !urlInput.startsWith('http')) {
    showError('Please enter a valid script URL.');
    return;
  }

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.startsWith('http')) {
    showError('Cannot inject on this page.');
    return;
  }

  const btn = document.getElementById('injectScriptBtn');
  const originalText = btn.textContent;
  btn.textContent = 'Injecting...';
  btn.disabled = true;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    args: [urlInput],
    function: (url) => {
      // Prevent duplicate injection
      const existing = document.querySelector(`script[src="${url}"]`);
      if (existing) {
        console.warn('[BIS Checker] Script already injected.');
        return false;
      }

      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      document.head.appendChild(script);
      console.log(`[BIS Checker] Injected script: ${url}`);
      return true;
    }
  }, (results) => {
    if (chrome.runtime.lastError) {
      showError('Failed to inject script.');
    } else {
      btn.textContent = 'Injected!';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
        document.getElementById('injectScriptUrl').value = '';
      }, 2000);
    }
  });
});

document.getElementById('checkCustomJsBtn').addEventListener('click', async () => {
  const btn = document.getElementById('checkCustomJsBtn');
  const resultsDiv = document.getElementById('customJsResults');

  // Reset Results UI
  resultsDiv.innerHTML = '';
  resultsDiv.classList.add('hidden');

  btn.textContent = 'Checking...';
  btn.disabled = true;

  try {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.startsWith('http')) {
      showError('Cannot run on this page.');
      btn.textContent = 'Check Custom JS';
      btn.disabled = false;
      return;
    }

    // Attempt to get Shopify domain from the active tab's global window object
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: () => {
        if (window.Shopify && window.Shopify.shop) {
          return window.Shopify.shop;
        }
        return null;
      }
    });

    const shopDomain = results && results[0] && results[0].result;

    if (!shopDomain) {
      showError('Could not find Shopify.shop domain. Ensure you are on a Shopify storefront.');
      btn.textContent = 'Check Custom JS';
      btn.disabled = false;
      return;
    }

    // Fetch the BIS Widget JSON and the Fallback JS concurrently
    const widgetUrl = `https://app.backinstock.org/api/bist/widget.json?shop=${shopDomain}&bist-key=Vkjc9ZT6KAJDGEos6w87acojjGkcX1fO`;
    const fallbackUrl = `https://script.google.com/macros/s/AKfycbwLSGxholUvq5mrLJ9esQx4S40oESS-ph4XULvx2e2RmkmkOCHEQxH2npyto-55qT09/exec?shop=${shopDomain}`;

    let widgetResponse, fallbackResponse;
    try {
      [widgetResponse, fallbackResponse] = await Promise.all([
        fetch(widgetUrl),
        fetch(fallbackUrl)
      ]);
    } catch (e) {
      throw new Error('Network error when fetching data: ' + e.message);
    }

    if (!widgetResponse.ok) {
        throw new Error(`BIS API HTTP error! status: ${widgetResponse.status}`);
    }

    const data = await widgetResponse.json();
    const customJs = data.custom_js;

    let fallbackJs = null;
    try {
      if (fallbackResponse) {
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          if (fallbackData.status === 'success' && fallbackData.customJs) {
            fallbackJs = fallbackData.customJs;
          } else if (fallbackData.status === 'error') {
            console.warn('Apps script returned error:', fallbackData.message);
          }
        } else {
           const errText = await fallbackResponse.text();
           console.error('Fallback fetch failed with status:', fallbackResponse.status, errText);
           alert(`Fallback error ${fallbackResponse.status}: ${errText}`);
        }
      }
    } catch (e) {
      console.error('Error fetching/parsing fallback JS:', e);
      alert('Error fetching fallback JS: ' + e.message);
    }

    resultsDiv.classList.remove('hidden');

    if (customJs && customJs.trim() !== '') {
        const wrapper = document.createElement('div');
        wrapper.className = 'item-wrapper';

        const header = document.createElement('div');
        header.className = 'item-header';
        header.textContent = 'Custom JS found:';

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'action-buttons';

        const textarea = document.createElement('textarea');
        textarea.readOnly = true;
        textarea.value = customJs;

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.onclick = () => {
          textarea.select();
          navigator.clipboard.writeText(textarea.value).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = originalText; }, 1500);
          });
        };

        const saveFallbackBtn = document.createElement('button');
        saveFallbackBtn.className = 'highlight-btn save-fallback-btn';
        saveFallbackBtn.textContent = 'Save as Fallback';
        saveFallbackBtn.onclick = async () => {
          const originalText = saveFallbackBtn.textContent;
          saveFallbackBtn.textContent = 'Saving...';
          saveFallbackBtn.disabled = true;

          try {
             // We use POST with JSON body for Apps Script
             const saveUrl = `https://script.google.com/macros/s/AKfycbwLSGxholUvq5mrLJ9esQx4S40oESS-ph4XULvx2e2RmkmkOCHEQxH2npyto-55qT09/exec`;
             const saveRes = await fetch(saveUrl, {
                method: 'POST',
                // Using text/plain avoids preflight CORS on Apps Script
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ shop: shopDomain, customJs: customJs })
             });
             const saveData = await saveRes.json();
             if (saveData.status === 'success') {
               saveFallbackBtn.textContent = 'Saved!';
               // We could auto-reload here or rely on the user seeing success
               setTimeout(() => { document.getElementById('checkCustomJsBtn').click(); }, 1500);
             } else {
               saveFallbackBtn.textContent = 'Error';
               console.error('Save failed:', saveData.message);
             }
          } catch(e) {
             console.error('Exception on save:', e);
             saveFallbackBtn.textContent = 'Error';
          }
          
          if (saveFallbackBtn.textContent === 'Error') {
             setTimeout(() => { 
                saveFallbackBtn.textContent = originalText; 
                saveFallbackBtn.disabled = false; 
             }, 2000);
          }
        };

        actionsDiv.appendChild(copyBtn);
        actionsDiv.appendChild(saveFallbackBtn);
        wrapper.appendChild(header);
        wrapper.appendChild(textarea);
        wrapper.appendChild(actionsDiv);
        resultsDiv.appendChild(wrapper);

    } else {
        const noJsError = document.createElement('p');
        noJsError.style.cssText = "color:#d9534f; font-weight:bold; padding: 10px; margin: 0; background: #fdf2f2; border: 1px solid #f2dede; border-radius: 4px;";
        noJsError.textContent = 'No Custom JS configured for this store.';
        resultsDiv.appendChild(noJsError);
    }

    // Render Fallback Section
    const fallbackWrapper = document.createElement('div');
    fallbackWrapper.className = 'item-wrapper';
    fallbackWrapper.style.marginTop = '15px';

    const fallbackHeader = document.createElement('div');
    fallbackHeader.className = 'item-header';
    fallbackHeader.textContent = 'Last Known Working JS (Fallback):';
    fallbackWrapper.appendChild(fallbackHeader);

    if (fallbackJs && fallbackJs.trim() !== '') {
        const fallbackTextarea = document.createElement('textarea');
        fallbackTextarea.readOnly = true;
        fallbackTextarea.value = fallbackJs;
        
        const fallbackActionsDiv = document.createElement('div');
        fallbackActionsDiv.className = 'action-buttons';

        const fallbackCopyBtn = document.createElement('button');
        fallbackCopyBtn.className = 'copy-btn';
        fallbackCopyBtn.textContent = 'Copy Fallback';
        fallbackCopyBtn.onclick = () => {
          fallbackTextarea.select();
          navigator.clipboard.writeText(fallbackTextarea.value).then(() => {
            const originalText = fallbackCopyBtn.textContent;
            fallbackCopyBtn.textContent = 'Copied!';
            setTimeout(() => { fallbackCopyBtn.textContent = originalText; }, 1500);
          });
        };

        fallbackActionsDiv.appendChild(fallbackCopyBtn);
        fallbackWrapper.appendChild(fallbackTextarea);
        fallbackWrapper.appendChild(fallbackActionsDiv);
    } else {
        const noFallbackMsg = document.createElement('p');
        noFallbackMsg.textContent = 'No fallback saved';
        noFallbackMsg.style.fontStyle = 'italic';
        noFallbackMsg.style.color = '#777';
        noFallbackMsg.style.margin = '10px 0 0 0';
        fallbackWrapper.appendChild(noFallbackMsg);
    }

    resultsDiv.appendChild(fallbackWrapper);

  } catch (error) {
    console.error('Error fetching Custom JS:', error);
    showError('Failed to fetch Custom JS.');
  } finally {
    btn.textContent = 'Check Custom JS';
    btn.disabled = false;
  }
});

function openBisEditor() {
  // This tool is used in the storefront to generate integration scripts

  // Create a hash for the integration script, so we know it wasn't changed
  String.prototype.hashCode = function () {
    var hash = 0, i, chr;
    if (this.length === 0) return hash;
    for (i = 0; i < this.length; i++) {
      chr = this.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  };

  // Generate integration scripts from Gist snippets
  class BistGenerator {
    constructor() {
      this.scriptsUrl = 'https://app.backinstock.org/api/bist/theme_integrations/snippets';
      this.loadScripts();
      this.script = this.script.bind(this);
    }

    optionsHash() {
      return {
        elementType: Bist.$('input[name=bist-element-type]:checked').value,
        elementTypePartially: Bist.$('[data-option=elementTypePartially]:checked').value,
        anchor: Bist.$('.bist-button-anchor').value,
        anchorPosition: Bist.$('input[name=bist-anchor-position]:checked').value,
        anchorSame: Bist.$('.bist-same-anchors').checked == true,
        anchorPartially: Bist.$('.bist-button-anchor-partially').value,
        anchorPositionPartially: Bist.$('input[name=bist-anchor-position-partially]:checked').value,
        autoDetectAnchor: Bist.$('input[name=bist-auto-detect]').checked == true,
        detectionName: Bist.$('input[name=bist-detection-script]:checked').value,
        detectionScript: bist.getDetectionScript(),
        classes: Bist.$('.bist-button-classes').value,
        classesPartially: Bist.$('.bist-button-classes-partially').value,
        style: Bist.$('.bist-button-style').value,
        stylePartially: Bist.$('.bist-button-style-partially').value,
        styleSame: Bist.$('.bist-same-style').checked == true,
        spacers: Bist.$('.bist-spacers').checked == true,
        syncWidth: Bist.$('.bist-sync-width').checked == true,
        syncWidthSelector: Bist.$('.bist-sync-width-selector').value,
        keepAbove: Bist.$('.bist-keep-above').checked == true,
        keepAboveSelector: Bist.$('.bist-keep-above-selector').value,
        selectable: Bist.$('.bist-always-visible-button').checked == true,
        refreshOnChange: Bist.$('.bist-refresh-on-document-change').checked == true,
        refreshOnClick: Bist.$('.bist-refresh-on-document-click').checked == true,
        refreshOnSoldoutChange: Bist.$('.bist-refresh-on-soldout-change').checked == true,
        soldoutButton: Bist.$('.bist-soldout-button').value
      };
    }

    loadScripts() {
      fetch(this.scriptsUrl)
        .then(res => res.json())
        .then(data => this.scripts = data.files);
    }

    finalScript() {
      const optionsHash = this.optionsHash();
      const baseOptions = {
        base: true,
        setAnchor: true,
        setAnchorPartially: true,
        setAnchors: true,
        setButton: true,
        setButtons: true,
        setStyle: true,
        setStyles: true,
      };

      let header = '// [config]\n';
      for (const key in optionsHash) {
        if (optionsHash[key].toString().trim() != '' && key != 'detectionScript')
          header += `// ${key}: ${optionsHash[key]}\n`;
      }
      header += '//\n';

      const options = { ...baseOptions, ...optionsHash };
      const script = this.script('base', options);
      const hashCode = (header + script).replace(/^\s+|\s+$/g, '').hashCode();
      const hash = `// [hash]\n// ${hashCode}\n//\n`;

      return hash + header + script;
    }

    script(scriptName, options) {
      if (options && options[scriptName] == true) {
        const script = this.script;
        return eval('`' + this.scripts[scriptName].content + '`');
      } else {
        return '';
      }
    }

    setOption(option, value) {
      const element = Bist.$(`[data-option=${option}]`);
      if (!element) {
        console.warn(`[BIST] Couldn't find element for option '${option}'`);
        return;
      }

      if (element.type == 'radio') {
        Bist.$(`[data-option=${option}][value="${value}"]`).checked = true;
      } else if (element.type == 'checkbox') {
        element.checked = (value === 'true');
      } else if (element.nodeType == 'textarea') {
        element.innerHTML = value;
      } else {
        element.value = value;
      }
    }

    checkHash(script) {
      const hash = script.match(/\/\/\s\[hash\]\r?\n\/\/(.+)/)[1];
      console.log(hash);
      let scriptWithoutHash = script.split('\n');
      scriptWithoutHash.splice(0, 3);
      scriptWithoutHash = scriptWithoutHash.join('\n').replace(/^\s+|\s+$/g, '');
      console.log(scriptWithoutHash);
      console.log(scriptWithoutHash.hashCode());
      return scriptWithoutHash.hashCode() == hash;
    }

    loadCurrentScript() {
      const url = `https://app.backinstock.org/api/bist/widget.json?shop=${Shopify.shop}&bist-key=Vkjc9ZT6KAJDGEos6w87acojjGkcX1fO`;
      fetch(url)
        .then(response => response.json())
        .then(data => {
          this.currentScript = data.custom_js;
          const regex = /\/\/\s\[config\]\r?\n([^]+)\/\/\s\r?\n/;
          const match = data.custom_js.match(regex);

          if (match) {
            const options = match[1].replaceAll('// ', '').split(/\r?\n/);
            options.pop();
            options.forEach(option => {
              const [key, value] = option.split(/: (.+)/);
              this.setOption(key, value);
            });
            this.detectCustomScript();
            if (this.onScriptLoad) this.onScriptLoad();
          } else {
            console.warn("[BIST] Couldn't load integration script config");
          }
        });
    }

    detectCustomScript() {
      console.log('detectCustomScript');
      const regex = /if \(BIS.popup.product.available\) \{\r?\n([\s\S]+)\}/m;
      const match = this.currentScript.match(regex);
      console.log(match);
    }
  }

  class TinyAutosize {
    constructor(textarea) {
      this.textarea = textarea;
      this.setup();
    }
    setup() {
      this.textarea.setAttribute('style', 'height:' + (this.textarea.scrollHeight) + 'px; overflow-y:hidden;');
      this.textarea.addEventListener('input', e => this.refreshHeight(e), false);
    }
    refreshHeight(e) {
      this.textarea.style.height = 'auto';
      this.textarea.style.height = (this.textarea.scrollHeight) + 'px';
    }
  }

  class DetectionScript { }

  class WidgetParser {
    constructor(callback) {
      const html = document.documentElement.innerHTML;
      let matches = html.match(/(app|staging)\.backinstock\.org\\\/bis\\\/widget\\\/((\d+)_(\d+))\.js/);
      if (!matches) return false;

      this.callback = callback;
      this.url = 'http://' + matches[0].replace(/\\/g, '');
      this.timestamp = matches[2];
      this.createdAt = new Date(parseInt(this.timestamp.split('_')[1]) * 1000);

      fetch(this.url).then(res => res.text());
    }
  }

  class Bist {
    constructor() {
      if (!window.BIS || (!BIS.popup && window.BISPopover)) {
        console.error("[Bist] Bist tool does not support Widget version 4");
        return;
      }

      this.widgetParser = new WidgetParser(this.updateSettings);
      this.panel = this.createPanel();
      this.createActionsMenu();
      this.paintPanel();
      this.attachEvents();
      this.refreshBISTrigger();
      this.overrideRefreshInlineButton();
      this.loadDetectionScripts();
      this.updateAnchorOccurrences();
    }

    static $(selector) { return document.querySelector(selector); }
    static $$(selector) { return document.querySelectorAll(selector); }

    createPanel() {
      const panel = document.createElement('div');
      panel.setAttribute('id', 'bist');
      panel.setAttribute('data-panel-selected', 'variants');
      document.body.appendChild(panel);
      return panel;
    }

    createActionsMenu() {
      const actionsMenu = document.createElement('nav');
      actionsMenu.setAttribute('id', 'bist-actions-menu');
      actionsMenu.innerHTML = `
        <button class='bist-run-script' type='button'>Run script</button>
        <button class='bist-remove-buttons' type='button'>Remove buttons</button>
        <button class='bist-copy-script' type='button'>Copy script</button>
        <div class='bist-actions-content'>
          BIS_trigger<br/>
          ID: <strong><span class='bist-bis-trigger-id'></span></strong> &nbsp;
          class: <strong><span class='bist-bis-trigger-class'></span></strong>
        </div>
      `;
      document.body.appendChild(actionsMenu);

      actionsMenu.querySelector('.bist-copy-script').addEventListener('click', (e) => this.copyScriptToClipboard(e));
    }

    paintPanel() {
      const button = Bist.$('#BIS_trigger');
      this.panel.innerHTML = `
        <style>
          #bist, #bist-actions-menu, #bist-actions-menu button, #bist input, #bist input:before, #bist label, #bist table,
          #bist tr, #bist td, #bist button, #bist textarea, #bist span, #bist h3, #bist nav, #bist  {
            width: initial;
            height: initial;
            min-height: initial;
            margin: initial;
            padding: initial;
            background-color: initial;
            text-transform: initial;
            font-weight: initial;
            letter-spacing: initial;
            font-style: initial;
            position: initial;
            color: white;
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
            font-size: 14px;
            border: 0;
            transform: initial;
          }

          #bist-actions-menu {
            color: #aaa;
            position: fixed;
            top: 0;
            left: 420px;
            width: 150px;
            z-index: 99999999999;
            background-color: #555;
            opacity: 0.9;
          }

          #bist-actions-menu button {
            width: 100%;
            display: block;
            height: 40px;
            color: white;
            text-align: left;
            padding-left: 15px;
          }

          #bist-actions-menu button:hover {
            background-color: #888;
          }

          #bist-actions-menu strong {
            color: white;
          }

          #bist-actions-menu .bist-actions-content {
            padding: 15px;
          }

          #bist ::placeholder {
            color: #bbb;
          }

          #bist {
            line-height: 1.4em;
            position: fixed;
            max-height: 100%;
            overflow: scroll;
            opacity: 0.9;
            padding: 0 12px 10px 12px;
            z-index: 9999999999;
            top: 0;
            left: 0;
            background-color: #555;
            width: 420px;
            text-align: left;
            box-shadow: 4px 4px 12px 5px rgba(0,0,0,0.3);
            box-sizing: border-box;
          }

          #bist-copy-textarea {
            text-transform: initial;
          }

          #bist, #bist nav {
            display: block;
          }

          #bist label, #bist input, #bist span {
            display: inline;
          }

          #bist input[type=radio] {
            -webkit-appearance: radio;
          }

          #bist input[type=checkbox] {
            -webkit-appearance: checkbox;
          }

          #bist a {
            color: #99f;
          }

          #bist button {
            padding: 2px 10px;
            background-color: #777;
            cursor: pointer;
          }

          #bist button:hover {
            background-color: #999;
          }

          #bist hr {
            width: calc(100% + 24px);
            border: none;
            height: 1px;
            background-color: #777;
            margin: 0 -12px 0 -12px;
          }

          #bist h3 {
            font-size: 20px;
            font-weight: bold;
            padding: 15px 0 10px 0;
            margin: 0;
            color: #bbb;
          }

          #bist .warning {
            color: #f56961;
            font-weight: bold;
          }

          #bist .hidden {
            display: none;
          }

          #bist .bist-menu, #bist .bist-button-menu {
            background-color: initial;
          }

          #bist .bist-menu a, #bist .bist-button-menu a {
            padding: 10px 15px;
            text-decoration: none;
            display: inline-block;
          }

          #bist span[data-variant-detection], #bist .bist-current-script {
            font-weight: bold;
          }

          #bist .bist-detection-script-custom {
            font-family: Monaco, 'Lucida Console', Courier;
            font-size: 11px;
          }

          #bist a:hover {
            color: white;
          }

          #bist a.bist-menu-minimize {
            float: right;
          }

          #bist .bist-anchor-position label {
            font-size: 13px;
          }

          #bist .bist-toggle-sku {
            float: right;
          }

          #bist .bist-caption {
            color: #bbb;
          }

          #bist .bist-sync-width-selector, #bist .bist-soldout-button, #bist .bist-keep-above-selector {
            width: 225px;
          }

          #bist .bist-default-anchor, #bist .bist-anchor-occurrences, .bist-anchor-occurrences-partially {
            float: right;
            margin-left: 15px;
          }

          #bist .bist-panel-variants, #bist .bist-panel-button, #bist .bist-panel-script {
            display: none;
          }

          #bist[data-panel-selected=variants] .bist-menu-variants {
            text-decoration: underline;
          }

          #bist[data-panel-selected=button] .bist-menu-button {
            text-decoration: underline;
          }

          #bist[data-panel-selected=script] .bist-menu-script {
            text-decoration: underline;
          }

          #bist .bist-panel-button[data-selected=fully] .bist-button-menu-fully {
            text-decoration: underline;
          }

          #bist .bist-panel-button[data-selected=partially] .bist-button-menu-partially {
            text-decoration: underline;
          }

          #bist .bist-button-fully, #bist .bist-button-partially {
            display: none;
          }

          #bist .bist-panel-button[data-selected=fully] .bist-button-fully {
            display: block;
          }

          #bist .bist-panel-button[data-selected=partially] .bist-button-partially {
            display: block;
          }

          #bist:not([data-minimized=true])[data-panel-selected=variants] .bist-panel-variants {
            display: block;
          }

          #bist:not([data-minimized=true])[data-panel-selected=button] .bist-panel-button {
            display: block;
          }

          #bist:not([data-minimized=true])[data-panel-selected=script] .bist-panel-script {
            display: block;
          }

          #bist .bist-same-anchors-label, #bist .bist-same-style-label {
            float: right;
            position: relative;
            top: 20px;
          }

          #bist .bist-variants-table, #bist .bist-variants-table td {
            border-bottom: solid 1px #777;
            font-size: 13px;
            padding: 3px;
            background: initial;
          }

          #bist .bist-variants-table-header td {
            font-size: 12px;
            color: #aaa;
          }

          #bist td.bist-variants-table-counter {
            color: #aaa;
            text-align: right;
            padding-right: 6px;
          }

          #bist .bist-variants-table-soldout td:first-child {
            font-weight: bold;
          }

          #bist .bist-button-classes, #bist .bist-button-classes-partially {
            margin-bottom: 4px;
          }

          #bist textarea, #bist input[type=text] {
            color: black;
            background-color: white;
          }

          #bist textarea {
            width: 100%;
            height: 40px;
            min-height: 40px;
          }

        </style>

        <nav class='bist-menu'>
          <a class='bist-menu-variants' href='#'>Variants</a>
          <a class='bist-menu-button' href='#'>Button</a>
          <a class='bist-menu-script' href='#'>Options</a>
          <a class='bist-menu-minimize' href='#'>-</a>
        </nav>
        <hr/>

        <div class='bist-panel-variants'>
          <h3>Page</h3>
          ${this.bisHiddenTagText()}
          Product ID:  <strong>${BIS.popup.product.id}</strong><br/>
          Inventory level: <strong>${BIS.Config.instock_qty_level}</strong><br/>
          Widget version: <strong>${this.widgetParser.timestamp}</strong><br/>
          Widget created: <strong>${this.widgetParser.createdAt}</strong><br/>
          Theme helper: ${this.themeHelper() ? '<strong>yes</strong> <a class="theme-helper-link" href="#">Show in console</a>' : '<strong>no</strong>'}

          <h3>Variant Detection</h3>
          <label>
            <input type='checkbox' class='bist-always-visible-button' data-option='selectable' checked='checked'></input> Variants are selectable
          </label>
          <div class='bist-detection-list'>
            <br/>
            <label>
              <input type='radio' checked='checked' data-option='detectionName' name='bist-detection-script' value='current'>
              Current: <span class='bist-current-script'></span>
            </label>
            <br/>
            <div class='bist-detection-scripts'>
              <!-- Dynamic content here -->
            </div>
            <label>
              <input type='radio' data-option='detectionName' name='bist-detection-script' value='custom'>
              Custom: <textarea class='bist-detection-script-custom'></textarea>
            </label>
          </div>

          <h3>All Variants</h3>
          <a class='bist-toggle-sku' href='#'>Toggle ID/SKU</a>
          <strong>${this.productAvailabilityText()}</strong>:
          <strong>${this.soldoutVariants().length}</strong> /
          <strong>${Object.keys(BIS.popup._variantsById).length}</strong>
          ${this.variantsTableText()}
        </div>

        <div class='bist-panel-button' data-selected='fully'>

          <div class='bist-button-menu'>
            <a class='bist-button-menu-fully' href='#'>Fully</a>
            <a class='bist-button-menu-partially' href='#'>Partially</a>
          </div>

          <div class='bist-button-fully'>
            <h3>Anchor</h3>
            <input type='checkbox' name='bist-auto-detect' checked /> Auto detect anchor
            <div class="bist-manual-detect">
              <div class='bist-anchor-position'>
                <label>
                  <input type='radio' name='bist-anchor-position' data-option='anchorPosition' value='beforebegin'> Before Begin &nbsp;
                </label>
                <label>
                  <input type='radio' name='bist-anchor-position' data-option='anchorPosition' value='afterbegin'> After Begin &nbsp;
                </label>
                <label>
                  <input type='radio' name='bist-anchor-position' data-option='anchorPosition' value='beforeend'> Before End &nbsp;
                </label>
                <label>
                  <input type='radio' name='bist-anchor-position' data-option='anchorPosition' value='afterend' checked='checked'> After End
                </label>
              </div>
              <textarea class='bist-button-anchor' data-option='anchor'>form[action ^= "/cart/add"]</textarea>
              <a class='bist-default-anchor' href='#'>Default anchor</a>
              <span class='bist-anchor-occurrences'>Occurrences: -</span>
              <span class='bist-caption bist-anchor-caption hidden'>Fully sold out</span>

              <br/>
              <br/>
            </div>
            <h3>Appearance</h3>
            <label>
              <input type='radio' name='bist-element-type' data-option='elementType' value='button' checked='checked'/> &lt;button&gt;
            </label>
            <label>
              <input type='radio' name='bist-element-type' data-option='elementType' value='a' /> &lt;a&gt;
            </label>
            <br/>
            <br/>
            <label class='bist-caption'>Classes</label>
            <textarea class='bist-button-classes' data-option='classes' placeholder='btn btn--full'></textarea>
            <label class='bist-caption'>Style</label>
            <textarea class='bist-button-style' data-option='style' placeholder='width:100%; margin-top:15px'></textarea>
          </div>

          <div class='bist-button-partially'>
            <label class='bist-same-anchors-label'>
              <input type='checkbox' class='bist-same-anchors' checked='checked' data-option='styleSame'>
              Same as fully
            </label>
            <h3>Anchor</h3>
            <div class='bist-anchor-div hidden'>
              <div class='bist-anchor-position'>
                <label>
                  <input type='radio' name='bist-anchor-position-partially' data-option='anchorPositionPartially' value='beforebegin' checked='checked'> Before Begin &nbsp;
                </label>
                <label>
                  <input type='radio' name='bist-anchor-position-partially' data-option='anchorPositionPartially' value='afterbegin'> After Begin &nbsp;
                </label>
                <label>
                  <input type='radio' name='bist-anchor-position-partially' data-option='anchorPositionPartially' value='beforeend'> Before End &nbsp;
                </label>
                <label>
                  <input type='radio' name='bist-anchor-position-partially' data-option='anchorPositionPartially' value='afterend'> After End
                </label>
              </div>
              <textarea class='bist-button-anchor-partially' data-option='anchorPartially'>${this.getButtonAnchor()}</textarea>
              <span class='bist-anchor-occurrences-partially'>Occurrences: -</span>
            </div>
            <br/>

            <label class='bist-same-style-label'>
              <input type='checkbox' class='bist-same-style' checked='checked' data-option='anchorSame'>
              Same as fully
            </label>
            <h3>Appearance</h3>
            <div class='bist-style-div hidden'>
              <label>
                <input type='radio' name='bist-element-type-partially' data-option='elementTypePartially' value='button' checked='checked'/> &lt;button&gt;
              </label>
              <label>
                <input type='radio' name='bist-element-type-partially' data-option='elementTypePartially' value='a' /> &lt;a&gt;
              </label>
              <br/>
              <br/>
              <label class='bist-caption'>Classes</label>
              <textarea class='bist-button-classes-partially' data-option='classesPartially' placeholder='btn btn--full'></textarea>
              <label class='bist-caption'>Style</label>
              <textarea class='bist-button-style-partially' data-option='stylePartially' placeholder='width:100%; margin-top:15px'></textarea>
            </div>
            <div style='clear:both'></div>

          </div>

        </div>

        <div class='bist-panel-script'>

          <h3>Show/hide button</h3>
          Refresh counter: <strong class='bist-click-count'></strong> &nbsp;&nbsp;
          <a href='#' class='bist-refresh-inline-button'>Refresh now</a>
          <br/>
          <label>
            <input type='checkbox' class='bist-refresh-on-document-click' data-option='refreshOnClick'> On document click<br/>
          </label>
          <label>
            <input type='checkbox' class='bist-refresh-on-document-change' data-option='refreshOnChange' checked='checked'> On document change<br/>
          </label>
          <label>
            <input type='checkbox' class='bist-refresh-on-soldout-change' data-option='refreshOnSoldoutChange'> Observe:
          </label>
          <input class='bist-soldout-button' type='text' data-option='soldoutButton' placeholder='#addToCart'/><br/>

          <h3>Options</h3>
          <label>
            <input type='checkbox' class='bist-spacers' data-option='spacers'></input> Spacers
          </label>
          <br/>
          <label>
            <input type='checkbox' class='bist-sync-width' data-option='syncWidth'></input> Sync width with:
          </label>
          <input class='bist-sync-width-selector' type='text' data-option='syncWidthSelector' placeholder='#addToCart'/><br/>
          <label>
            <input type='checkbox' class='bist-keep-above' data-option='keepAbove'></input> Keep above:
          </label>
          <input class='bist-keep-above-selector' type='text' data-option='keepAboveSelector' placeholder='#facebookMessenger'/>
          <br/>

        </div>
      `;
    }

    showHideDetectionList() {
      const display = Bist.$('.bist-always-visible-button').checked ? '' : 'none';
      Bist.$('.bist-detection-list').style.display = display;
    }

    showHideAnchors() {
      Bist.$('.bist-same-anchors').checked ? Bist.$('.bist-anchor-div').classList.add('hidden') : Bist.$('.bist-anchor-div').classList.remove('hidden');
    }

    showHideStyle() {
      Bist.$('.bist-same-style').checked ? Bist.$('.bist-style-div').classList.add('hidden') : Bist.$('.bist-style-div').classList.remove('hidden');
    }

    attachEvents() {
      const classesAutosize = new TinyAutosize(Bist.$('.bist-button-classes'));
      const styleAutosize = new TinyAutosize(Bist.$('.bist-button-style'));
      const customAutosize = new TinyAutosize(Bist.$('.bist-detection-script-custom'));

      Bist.$('.bist-menu-variants').addEventListener('click', e => {
        e.preventDefault();
        this.panel.setAttribute('data-panel-selected', 'variants');
      });

      Bist.$('.bist-menu-button').addEventListener('click', e => {
        e.preventDefault();
        this.panel.setAttribute('data-panel-selected', 'button');
      });

      Bist.$('.bist-menu-script').addEventListener('click', e => {
        e.preventDefault();
        this.panel.setAttribute('data-panel-selected', 'script');
        classesAutosize.refreshHeight();
        styleAutosize.refreshHeight();
        customAutosize.refreshHeight();
      });

      Bist.$('.bist-button-menu-fully').addEventListener('click', e => {
        e.preventDefault();
        Bist.$('.bist-panel-button').setAttribute('data-selected', 'fully');
      });

      Bist.$('.bist-button-menu-partially').addEventListener('click', e => {
        e.preventDefault();
        Bist.$('.bist-panel-button').setAttribute('data-selected', 'partially');
      });

      Bist.$('.bist-always-visible-button').addEventListener('click', () => this.showHideDetectionList());

      Bist.$('.bist-menu-minimize').addEventListener('click', e => {
        e.preventDefault();
        const isMinimized = this.panel.getAttribute('data-minimized') === 'true';
        this.panel.setAttribute('data-minimized', !isMinimized);
        Bist.$('#bist-actions-menu').style.display = isMinimized ? '' : 'none';
      });

      if (Bist.$('.theme-helper-link')) {
        Bist.$('.theme-helper-link').addEventListener('click', e => {
          e.preventDefault();
          console.log(this.themeHelper());
        });
      }

      Bist.$('.bist-refresh-inline-button').addEventListener('click', e => {
        e.preventDefault();
        BIS.refreshInlineButton();
      });

      Bist.$('.bist-toggle-sku').addEventListener('click', e => {
        e.preventDefault();
        Bist.$$('.bist-variants-table-expanded').forEach(element => element.classList.toggle('hidden'));
      });

      Bist.$('.bist-same-style').addEventListener('click', () => this.showHideStyle());
      Bist.$('.bist-same-anchors').addEventListener('click', () => this.showHideAnchors());

      Bist.$('.bist-manual-detect').style.display = "none";

      Bist.$('input[name=bist-auto-detect]').addEventListener('click', e => {
        if (e.target.checked) {
          Bist.$('.bist-manual-detect').style.display = "none";
        } else {
          Bist.$('.bist-manual-detect').style.display = "block";
        }
      });

      Bist.$('.bist-default-anchor').addEventListener('click', e => {
        e.preventDefault();
        Bist.$('.bist-button-anchor').value = 'form[action ^= "/cart/add"]';
        Bist.$('.bist-anchor-position [value=afterend]').checked = true;
        this.updateAnchorOccurrences();
      });

      Bist.$('.bist-button-anchor').addEventListener('keyup', () => this.updateAnchorOccurrences());
      Bist.$('.bist-button-anchor-partially').addEventListener('keyup', () => this.updateAnchorOccurrences());

      Bist.$('.bist-run-script').addEventListener('click', e => {
        e.preventDefault();
        this.runScript();
      });

      Bist.$('.bist-remove-buttons').addEventListener('click', e => {
        this.removeButtons();
        this.refreshBISTrigger();
      });

      document.addEventListener('keyup', e => {
        if (!e.target.className.includes('bist-button-style') &&
          !e.target.className.includes('bist-button-classes') &&
          !e.target.className.includes('bist-button-style-partially') &&
          !e.target.className.includes('bist-button-classes-partially'))
          return;

        const button = Bist.$('#BIS_trigger');
        if (!button) return;

        const sameStyle = Bist.$('.bist-same-style').checked;

        if (BIS.popup.product.available) {
          button.style.cssText = sameStyle ? Bist.$('.bist-button-style').value : Bist.$('.bist-button-style-partially').value;
          button.className = sameStyle ? Bist.$('.bist-button-classes').value : Bist.$('.bist-button-classes-partially').value;
        } else {
          button.style.cssText = Bist.$('.bist-button-style').value;
          button.className = Bist.$('.bist-button-classes').value;
        }

        this.refreshBISTrigger();
        if (BIS.syncInlineButtonWidth) BIS.syncInlineButtonWidth();
      });
    }

    updateSettings(settings) {
      if (settings.anchorPosition)
        document.querySelector(`.bist-anchor-position [value=${settings.anchorPosition}]`).checked = true;
    }

    themeHelper() {
      const helper = Bist.$('#back-in-stock-helper') || Bist.$('#back-in-stock-helper-embedded');
      if (helper) return helper.outerHTML;
    }

    bisHiddenTagText() {
      const hideTags = BIS.Config.hide_for_product_tags.replace(' ', '').split(',');
      const foundHideTag = hideTags.find(element => BIS.popup.product.tags.includes(element));
      return foundHideTag !== undefined ? `<span class="warning">Has "${foundHideTag}" hide tag</span><br/>` : '';
    }

    getButtonAnchor() {
      return BIS.inlineButtonAnchor ? BIS.inlineButtonAnchor : '';
    }

    soldoutVariants() {
      return BIS.popup.variants;
    }

    productAvailabilityText() {
      let availabilityText = '<span class="warning">No sold out variant found</span>';
      if (this.soldoutVariants().length > 0) {
        availabilityText = BIS.popup.product.available ? 'Partially sold out' : 'Fully sold out';
      }
      return availabilityText;
    }

    soldoutQuantityText() {
      return `(${this.soldoutVariants().length}`;
    }

    buttonInserted() {
      return Bist.$('#BIS_trigger') || Bist.$('.BIS_trigger');
    }

    detectVariantText() {
      let selectedVariant = BIS.detectVariant(BIS.popup);
      if (!selectedVariant) return selectedVariant;
      let isSoldout = BIS.popup.variantIsUnavailable(selectedVariant);
      return (isSoldout ? '[S] ' : '') + selectedVariant.title;
    }

    showDetectionScripts() {
      let output = '';
      this.originalDetectVariant = BIS.detectVariant;
      for (var key in this.variantDetectionScripts) {
        let script = this.variantDetectionScripts[key].content;
        output += `
          <label>
            <input type='radio' name='bist-detection-script' data-option='detectionName' value='${key}'>
            ${key}
            <a href='#' class='bist-copy-detection-btn' data-key='${key}' data-content='${script}'>Copy</a>:
            <span data-variant-detection='${key}'></span>
          </label>
          <br/>
        `;
      }
      Bist.$('.bist-detection-scripts').innerHTML = output;

      document.querySelectorAll('.bist-copy-detection-btn').forEach(btn => {
        btn.addEventListener('click', (e) => this.copyDetectionScriptToClipboard(e, e.target.getAttribute('data-key')));
      });
    }

    removeButtons() {
      let button;
      while (button = document.getElementsByClassName('BIS_trigger')[0]) {
        button.parentNode.removeChild(button);
      }
      while (button = document.querySelectorAll('#BIS_trigger')[0]) {
        button.parentNode.removeChild(button);
      }
      while (button = document.querySelectorAll('.bis-spacer')[0]) {
        button.parentNode.removeChild(button);
      }

      document.removeEventListener('click', BIS.delayedRefreshInlineButton);
      document.removeEventListener('change', BIS.delayedRefreshInlineButton);
      if (BIS.inlineButtonObserver) BIS.inlineButtonObserver.disconnect();

      Bist.$('.bist-click-count').innerHTML = 'Button not found';
    }

    getDetectionScript() {
      let detectionScript;
      const detectionScriptName = Bist.$('input[name=bist-detection-script]:checked').value;

      switch (detectionScriptName) {
        case 'current':
          return '';
        case 'custom':
          detectionScript = Bist.$('.bist-detection-script-custom').value;
          break;
        default:
          detectionScript = this.variantDetectionScripts[detectionScriptName].content;
      }

      return `
      // Custom variant detection
      if (BIS.popup.product.available) {
        ${detectionScript}
      }
      `;
    }

    runScript() {
      eval(this.generator.finalScript());
      this.overrideRefreshInlineButton();
      setTimeout(() => this.refreshBISTrigger(), 20);
    }

    refreshBISTrigger() {
      let el = document.querySelectorAll('#BIS_trigger');
      let hidden = (el[0] && el[0].style.display === 'none');
      Bist.$('.bist-bis-trigger-id').innerHTML = el.length + (hidden ? ' [hidden]' : '');

      el = document.getElementsByClassName('BIS_trigger');
      hidden = (el[0] && el[0].style.display === 'none');
      Bist.$('.bist-bis-trigger-class').innerHTML = el.length + (hidden ? ' [hidden]' : '');
    }

    copyScriptToClipboard(e) {
      e.preventDefault();
      e.stopPropagation();
      this.copyToClipboard(this.generator.finalScript());
    }

    copyDetectionScriptToClipboard(e, key) {
      e.preventDefault();
      e.stopPropagation();
      const script = this.variantDetectionScripts[key].content;
      this.copyToClipboard(script);
    }

    copyToClipboard(content) {
      const el = document.createElement('textarea');
      el.setAttribute('id', 'bist-copy-textarea');
      el.value = content;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }

    variantsTableText() {
      const variants = BIS.popup._variantsByTitle;
      let rows = `
        <tr class='bist-variants-table-header'>
          <td></td>
          <td></td>
          <td class='bist-variants-table-expanded hidden'>ID</td>
          <td class='bist-variants-table-expanded hidden'>SKU</td>
          <td>title</td>
          <td>q</td>
          <td>inv policy</td>
          <td>inv manag</td>
        </tr>
      `;
      let i = 1;
      for (let title in variants) {
        const ids = BIS.popup.variants.map((v) => v.id);
        let soldout = ids.includes(variants[title].id);
        rows += `
          <tr ${soldout ? 'class="bist-variants-table-soldout"' : ''}>
            <td>${soldout ? '[S]' : ''}</td>
            <td class='bist-variants-table-counter'> ${i++} </td>
            <td class='bist-variants-table-expanded hidden'>${variants[title].id}</td>
            <td class='bist-variants-table-expanded hidden'>${variants[title].sku}</td>
            <td>${title}</td>
            <td>${variants[title].inventory_quantity}</td>
            <td>${variants[title].inventory_policy}</td>
            <td>${variants[title].inventory_management}</td>
          </tr>`;
      }
      return `<table class='bist-variants-table'>${rows}</table>`;
    }

    loadDetectionScripts() {
      fetch('https://api.github.com/gists/dfb3cd8d8e09d7e7fdd79b3a9c51eaf4')
        .then(res => res.json())
        .then(data => this.variantDetectionScripts = data.files)
        .then(_ => this.showDetectionScripts())
        .then(_ => this.refreshDetectionScripts())
        .then(_ => {
          Bist.$$('[name=bist-detection-script]').forEach(element => {
            element.addEventListener('click', () => this.showHideCustomDetectionScript());
          });

          this.generator = new BistGenerator();
          this.generator.onScriptLoad = _ => {
            this.showHideDetectionList();
            this.updateAnchorOccurrences();
            this.showHideAnchors();
            this.showHideStyle();
            this.showHideCustomDetectionScript();
          };
          this.generator.loadCurrentScript();
        });
    }

    updateAnchorOccurrences() {
      const updateOcurrences = function (anchorSelector, outputSelector) {
        const anchor = Bist.$(anchorSelector).value;
        let occurrences;
        try {
          occurrences = Bist.$$(anchor).length;
        } catch (err) {
          occurrences = '[error]';
        }
        Bist.$(outputSelector).innerHTML = 'Occurrences: ' + occurrences;
      };

      updateOcurrences('.bist-button-anchor', '.bist-anchor-occurrences');
      updateOcurrences('.bist-button-anchor-partially', '.bist-anchor-occurrences-partially');
    }

    refreshDetectionScripts() {
      this.originalDetectVariant = BIS.detectVariant;

      Bist.$('.bist-current-script').innerHTML = this.detectVariantText();
      for (var key in this.variantDetectionScripts) {
        let script = this.variantDetectionScripts[key].content;
        let result;
        try {
          eval(script);
          result = this.detectVariantText();
        } catch (err) {
          result = '(error)';
        }
        Bist.$(`[data-variant-detection='${key}']`).innerHTML = result;
      }
      BIS.detectVariant = this.originalDetectVariant;

      setTimeout(() => {
        this.refreshDetectionScripts();
      }, 1000);
    }

    showHideCustomDetectionScript() {
      if (Bist.$('[name=bist-detection-script][value=custom]').checked) {
        Bist.$('.bist-detection-script-custom').classList.remove('hidden');
      } else {
        Bist.$('.bist-detection-script-custom').classList.add('hidden');
      }
    }

    overrideRefreshInlineButton() {
      if (!this.buttonInserted()) {
        Bist.$('.bist-click-count').innerHTML = 'Button not found';
        return;
      }

      if (!BIS.refreshInlineButton) {
        Bist.$('.bist-click-count').innerHTML = 'Script not compatible';
      }

      this.originalRefreshInlineButton = BIS.refreshInlineButton;
      this.variantSelectCount = 0;
      BIS.refreshInlineButton = () => {
        Bist.$('.bist-click-count').innerHTML = ++this.variantSelectCount;
        setTimeout(() => this.refreshBISTrigger(), 20);
        this.originalRefreshInlineButton();
      };

      Bist.$('.bist-click-count').innerHTML = this.variantSelectCount;
    }
  }

  let bist = new Bist();
}

document.getElementById('checkBisProductBtn').addEventListener('click', async () => {
  const btn = document.getElementById('checkBisProductBtn');
  const resultsDiv = document.getElementById('bisResults');

  btn.textContent = 'Checking...';
  btn.disabled = true;
  resultsDiv.innerHTML = '';
  resultsDiv.classList.add('hidden');

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || !tab.url.startsWith('http') || !tab.url.includes('/products/')) {
    showError('Please navigate to a Shopify product page.');
    btn.textContent = 'Check BIS Product';
    btn.disabled = false;
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    function: async () => {
      try {
        const urlToFetch = window.location.origin + window.location.pathname + '.js';
        const res = await fetch(urlToFetch);
        if (!res.ok) throw new Error('Failed to fetch product .js data');
        const data = await res.json();

        if (!data.variants) throw new Error('No variants found in JSON');

        let bisConfig = null;
        if (window.BIS && window.BIS.Config) {
          bisConfig = window.BIS.Config;
        } else if (window._BISConfig) {
          bisConfig = window._BISConfig;
        }

        // Also grab LiquidPreOrdersConfig - it has accurate oos/policy for ALL variants
        let liquidConfig = null;
        if (window.LiquidPreOrdersConfig) {
          liquidConfig = window.LiquidPreOrdersConfig;
        }

        const tags = data.tags || [];
        const hideTagsRaw = bisConfig && bisConfig.hide_for_product_tags ? bisConfig.hide_for_product_tags : 'bis-hidden';
        const hideTags = hideTagsRaw.split(',').map(t => t.trim().toLowerCase());
        const hasHideTag = tags.some(tag => hideTags.includes(tag.toLowerCase()));

        // Data sources for variant inventory (in priority order):
        // 1. BIS.Config.product.variants (only has variants where continue selling is OFF)
        // 2. LiquidPreOrdersConfig.variants (has ALL variants with accurate oos/policy)
        // 3. Product JSON (may have fields stripped by theme)
        const bisVariants = (bisConfig && bisConfig.product && bisConfig.product.variants) ? bisConfig.product.variants : [];
        const liquidVariants = (liquidConfig && liquidConfig.variants) ? liquidConfig.variants : {};

        const variants = data.variants.map(v => {
          const bisVariant = bisVariants.find(bv => bv.id === v.id);
          const liquidVariant = liquidVariants[String(v.id)] || null;

          // Quantity: JSON -> BIS.Config -> LiquidConfig (oos flag)
          let qty = v.inventory_quantity;
          if (qty == null && bisVariant && bisVariant.inventory_quantity != null) qty = bisVariant.inventory_quantity;

          // OOS flag from liquid config (most reliable)
          let liquidOOS = null;
          if (liquidVariant && typeof liquidVariant.oos !== 'undefined') {
            liquidOOS = liquidVariant.oos;
          }

          // Policy: JSON -> BIS.Config -> LiquidConfig
          let policy = v.inventory_policy;
          if (policy == null && bisVariant && bisVariant.inventory_policy != null) policy = bisVariant.inventory_policy;
          if (policy == null && liquidVariant && liquidVariant.inventory_policy != null) policy = liquidVariant.inventory_policy;

          // Management: JSON -> BIS.Config -> LiquidConfig
          let management = v.inventory_management;
          if (management == null && bisVariant && bisVariant.inventory_management != null) management = bisVariant.inventory_management;

          return {
            id: v.id,
            title: v.title || v.name || v.public_title || 'Single Product',
            qty: qty,
            policy: policy,
            management: management,
            available: v.available,
            liquidOOS: liquidOOS
          };
        });

        return { variants, bisConfig, hasHideTag, hideTags, tags };
      } catch (err) {
        return { error: err.message };
      }
    }
  }, (results) => {
    btn.textContent = 'Check BIS Product';
    btn.disabled = false;

    if (chrome.runtime.lastError || !results || !results[0]) {
      showError('Failed to execute script on the page.');
      return;
    }

    const data = results[0].result;
    if (data && data.error) {
      showError('Error: ' + data.error);
      return;
    }

    if (data && data.variants && Array.isArray(data.variants)) {
      resultsDiv.classList.remove('hidden');

      if (!data.bisConfig) {
        const errorBanner = document.createElement('div');
        errorBanner.style.padding = '10px';
        errorBanner.style.marginBottom = '15px';
        errorBanner.style.backgroundColor = '#fff5ea';
        errorBanner.style.borderLeft = '4px solid #b98900';
        errorBanner.innerHTML = '<strong>⚠️ BIS Config Missing:</strong> Could not find BIS.Config on the page. The widget might not be loaded.';
        resultsDiv.appendChild(errorBanner);
      }

      if (data.hasHideTag) {
        const errorBanner = document.createElement('div');
        errorBanner.style.padding = '10px';
        errorBanner.style.marginBottom = '15px';
        errorBanner.style.backgroundColor = '#ffeef0';
        errorBanner.style.borderLeft = '4px solid #d82c0d';
        errorBanner.innerHTML = '<strong>⚠️ Hidden by Tag:</strong> The product has a tag matching the hide list: <code>' + data.hideTags.join(', ') + '</code>';
        resultsDiv.appendChild(errorBanner);
      }

      data.variants.forEach((v) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'item-wrapper';
        wrapper.style.marginBottom = '8px';

        const header = document.createElement('div');
        header.className = 'item-header';
        const displayTitle = v.title === 'Default Title' ? 'Single Product' : v.title;
        header.innerHTML = `<span>Variant: ${displayTitle}</span>`;

        const goToBtn = document.createElement('button');
        goToBtn.className = 'highlight-btn';
        goToBtn.textContent = 'Go to variant';
        goToBtn.style.padding = '2px 8px';
        goToBtn.onclick = () => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'MAIN',
            function: (variantId) => {
              const url = new URL(window.location.href);
              url.searchParams.set('variant', variantId);
              window.location.href = url.toString();
            },
            args: [v.id]
          });
        };
        header.appendChild(goToBtn);

        const details = document.createElement('div');
        details.style.fontSize = '12px';
        details.style.marginTop = '4px';

        // Determine stock status using all data sources
        let isOOS = false;
        if (v.liquidOOS !== null) {
          // LiquidPreOrdersConfig is the most accurate source
          isOOS = v.liquidOOS === true;
        } else if (v.qty !== undefined && v.qty !== null) {
          isOOS = v.qty <= 0;
        } else {
          isOOS = v.available === false;
        }

        // Determine continue selling from policy
        let continueSelling = false;
        if (v.policy === 'continue') {
          continueSelling = true;
        } else if (v.policy === 'deny') {
          continueSelling = false;
        } else {
          // No policy data available - if variant is available AND OOS, it must be continue selling
          if (v.available === true && isOOS) continueSelling = true;
        }

        // Determine inventory tracking
        const tracking = v.management || 'None';
        let isTracked = (tracking === 'shopify' || tracking === true || tracking === 'true');

        // Build reasons
        let reasons = [];

        // Stock: OOS = green (good for BIS), In Stock = red (bad for BIS)
        const stockText = isOOS ? 'OOS' : 'In Stock';
        const stockColor = isOOS ? '#008060' : '#d82c0d';
        if (!isOOS) reasons.push('Product is in stock.');

        // Inventory Tracking: True = green, False = red
        const trackText = isTracked ? 'True' : 'False';
        const trackColor = isTracked ? '#008060' : '#d82c0d';
        if (!isTracked) reasons.push('Inventory tracking is not enabled.');

        // Continue Selling: False = green (good for BIS), True = red (bad for BIS)
        const csText = continueSelling ? 'True' : 'False';
        const csColor = !continueSelling ? '#008060' : '#d82c0d';
        if (continueSelling) reasons.push("'Continue Selling When OOS' is true.");

        // Hidden by tag: None = green, tag = red
        let tagText = 'None';
        let tagColor = '#008060';
        if (data.hasHideTag) {
          tagText = data.hideTags.join(', ');
          tagColor = '#d82c0d';
          reasons.push("Product has exclusion tag '" + tagText + "'.");
        }

        const shouldShow = reasons.length === 0;

        details.innerHTML = `
          <strong>Stock:</strong> <span style="color:${stockColor}; font-weight:bold;">${stockText}</span><br/>
          <strong>Inventory Tracking:</strong> <span style="color:${trackColor}; font-weight:bold;">${trackText}</span><br/>
          <strong>Continue Selling When OOS:</strong> <span style="color:${csColor}; font-weight:bold;">${csText}</span><br/>
          <strong>Hidden by tag:</strong> <span style="color:${tagColor}; font-weight:bold;">${tagText}</span><br/>
        `;

        if (shouldShow) {
          details.innerHTML += `
            <span style="color:#008060; font-size:11px;">
              ✅ BIS button should be visible.
            </span>
          `;
        } else {
          details.innerHTML += `
            <span style="color:#d82c0d; font-size:11px;">
              ❌ BIS button will NOT show.<br/>
              <em>Reasons: ${reasons.join(' ')}</em>
            </span>
          `;
        }
        wrapper.appendChild(header);
        wrapper.appendChild(details);
        resultsDiv.appendChild(wrapper);
      });

      if (data.bisConfig) {
        const settingsWrapper = document.createElement('div');
        settingsWrapper.className = 'item-wrapper';
        settingsWrapper.style.marginTop = '15px';
        settingsWrapper.style.padding = '10px';
        settingsWrapper.style.backgroundColor = '#f4f6f8';
        settingsWrapper.style.border = '1px solid #dfe3e8';
        settingsWrapper.style.borderRadius = '3px';

        const settingsHeader = document.createElement('div');
        settingsHeader.className = 'item-header';
        settingsHeader.innerHTML = '<span style="font-weight: bold; color: #202223;">⚙️ BIS Settings</span>';
        settingsHeader.style.marginBottom = '8px';

        const settingsDetails = document.createElement('div');
        settingsDetails.style.fontSize = '12px';

        for (const [key, value] of Object.entries(data.bisConfig)) {
          if (typeof value !== 'object' && value !== null) {
            const row = document.createElement('div');
            row.style.marginBottom = '4px';

            const keyLabel = document.createElement('strong');
            keyLabel.textContent = key + ': ';
            row.appendChild(keyLabel);

            let strVal = String(value);
            if (strVal.length > 100) {
              const valSpan = document.createElement('span');
              valSpan.style.color = '#6d7175';
              valSpan.textContent = strVal.substring(0, 100) + '...';
              row.appendChild(valSpan);

              const btn = document.createElement('button');
              btn.className = 'highlight-btn';
              btn.textContent = 'Show All';
              btn.style.padding = '1px 4px';
              btn.style.fontSize = '10px';
              btn.style.marginLeft = '5px';

              btn.addEventListener('click', () => {
                const modal = document.createElement('div');
                modal.style.position = 'fixed';
                modal.style.top = '10%';
                modal.style.left = '10%';
                modal.style.width = '80%';
                modal.style.maxHeight = '80%';
                modal.style.backgroundColor = 'white';
                modal.style.border = '1px solid #ccc';
                modal.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                modal.style.zIndex = '1000';
                modal.style.display = 'flex';
                modal.style.flexDirection = 'column';

                const modalHeader = document.createElement('div');
                modalHeader.style.padding = '10px';
                modalHeader.style.borderBottom = '1px solid #eee';
                modalHeader.style.fontWeight = 'bold';
                modalHeader.style.display = 'flex';
                modalHeader.style.justifyContent = 'space-between';
                modalHeader.innerHTML = '<span>' + key + '</span>';

                const closeBtn = document.createElement('button');
                closeBtn.textContent = '✖';
                closeBtn.style.cursor = 'pointer';
                closeBtn.style.border = 'none';
                closeBtn.style.background = 'none';
                closeBtn.onclick = () => document.body.removeChild(modal);
                modalHeader.appendChild(closeBtn);

                const modalBody = document.createElement('div');
                modalBody.style.padding = '10px';
                modalBody.style.overflowY = 'auto';
                modalBody.style.whiteSpace = 'pre-wrap';
                modalBody.style.wordBreak = 'break-all';
                modalBody.style.fontSize = '11px';
                modalBody.textContent = strVal;

                modal.appendChild(modalHeader);
                modal.appendChild(modalBody);
                document.body.appendChild(modal);
              });
              row.appendChild(btn);
            } else {
              const valSpan = document.createElement('span');
              valSpan.style.color = '#6d7175';
              valSpan.textContent = strVal;
              row.appendChild(valSpan);
            }
            settingsDetails.appendChild(row);
          }
        }

        settingsWrapper.appendChild(settingsHeader);
        settingsWrapper.appendChild(settingsDetails);
        resultsDiv.appendChild(settingsWrapper);
      }

    } else {
      showError('No variant data returned.');
    }
  });
});

document.getElementById('checkPreorderBtn').addEventListener('click', async () => {
  const btn = document.getElementById('checkPreorderBtn');
  const resultsDiv = document.getElementById('preorderResults');

  btn.textContent = 'Checking...';
  btn.disabled = true;
  resultsDiv.innerHTML = '';
  resultsDiv.classList.add('hidden');

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || !tab.url.startsWith('http') || !tab.url.includes('/products/')) {
    showPreorderError('Please navigate to a Shopify product page.');
    btn.textContent = 'Check Preorder Product';
    btn.disabled = false;
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    function: async () => {
      try {
        const urlToFetch = window.location.origin + window.location.pathname + '.js';
        const res = await fetch(urlToFetch);
        if (!res.ok) throw new Error('Failed to fetch product .js data');
        const data = await res.json();

        if (!data.variants) throw new Error('No variants found in JSON');

        // Extract Preorder Settings from BIS Widget Script
        let preorderSettings = null;
        let liquidPreorderSettings = null;

        // Since we are running in world: 'MAIN', we can access the page's window object directly
        if (window.AppPreOrdersConfig) {
          preorderSettings = window.AppPreOrdersConfig;
        } else if (window.BIS && window.BIS.PreConfig) {
          preorderSettings = window.BIS.PreConfig;
        } else if (window.BISConfig) {
          preorderSettings = window.BISConfig;
        }

        if (window.LiquidPreOrdersConfig) {
          liquidPreorderSettings = window.LiquidPreOrdersConfig;
        }

        // Top-level checks
        const noLiquidHelper = !liquidPreorderSettings;
        const noJsWidget = !preorderSettings;
        const isPreordersDisabledGlobally = preorderSettings && preorderSettings.purchases_enabled === false;

        const variants = data.variants.map(v => ({
          id: v.id,
          title: v.title || v.name || v.public_title || 'Single Product',
          qty: v.inventory_quantity,
          policy: v.inventory_policy,
          management: v.inventory_management
        }));

        return { variants, preorderSettings, liquidPreorderSettings, noLiquidHelper, noJsWidget, isPreordersDisabledGlobally };
      } catch (err) {
        return { error: err.message };
      }
    }
  }, (results) => {
    btn.textContent = 'Check Preorder Product';
    btn.disabled = false;

    if (chrome.runtime.lastError || !results || !results[0]) {
      showPreorderError('Failed to execute script on the page.');
      return;
    }

    const data = results[0].result;
    if (data && data.error) {
      showPreorderError('Error: ' + data.error);
      return;
    }

    if (data && data.variants && Array.isArray(data.variants)) {
      resultsDiv.classList.remove('hidden');

      // 1. App Embed and Preorder is Disabled (JS Widget exists and says it's disabled)
      if (data.noLiquidHelper && data.isPreordersDisabledGlobally) {
        const errorBanner = document.createElement('div');
        errorBanner.style.padding = '10px';
        errorBanner.style.marginBottom = '15px';
        errorBanner.style.backgroundColor = '#ffeef0';
        errorBanner.style.borderLeft = '4px solid #d82c0d';
        errorBanner.innerHTML = `<strong>⚠️ App Embed & Preorder Disabled:</strong> The BIS App Embed is disabled in the Theme Editor, AND preorders are turned OFF in the app settings.`;
        resultsDiv.appendChild(errorBanner);
      }
      // 2. Preorder is Disabled (App Embed is active)
      else if (!data.noLiquidHelper && data.isPreordersDisabledGlobally) {
        const errorBanner = document.createElement('div');
        errorBanner.style.padding = '10px';
        errorBanner.style.marginBottom = '15px';
        errorBanner.style.backgroundColor = '#ffeef0';
        errorBanner.style.borderLeft = '4px solid #d82c0d';
        errorBanner.innerHTML = `<strong>⚠️ Preorder Disabled:</strong> The Preorder feature is currently turned OFF in the app settings.`;
        resultsDiv.appendChild(errorBanner);
      }
      // 3. App Embed is Disabled (and Preorder is ON, or JS Widget is missing entirely)
      else if (data.noLiquidHelper) {
        const errorBanner = document.createElement('div');
        errorBanner.style.padding = '10px';
        errorBanner.style.marginBottom = '15px';
        errorBanner.style.backgroundColor = '#fff5ea';
        errorBanner.style.borderLeft = '4px solid #b98900';
        errorBanner.innerHTML = `<strong>⚠️ App Embed Disabled or Missing:</strong> The BIS App Embed is turned off in the Theme Editor.`;
        resultsDiv.appendChild(errorBanner);
      }

      // Skip rendering variant blocks if helper is missing or preorders are globally disabled
      if (!data.noLiquidHelper && !data.isPreordersDisabledGlobally) {
        data.variants.forEach((v, index) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'item-wrapper';
          wrapper.style.marginBottom = '8px';

          const header = document.createElement('div');
          header.className = 'item-header';

          // Prioritize LiquidPreOrdersConfig data (from BIS app backend) over product JSON
          // because themes can hide inventory_policy/inventory_quantity from the JSON endpoint
          const liquidVariant = data.liquidPreorderSettings
            && data.liquidPreorderSettings.variants
            && data.liquidPreorderSettings.variants[String(v.id)];

          // Policy processing: Handle missing json data cleanly
          const isContinue = liquidVariant
            ? liquidVariant.inventory_policy === 'continue'
            : (v.policy === 'continue');

          let continueText = 'False';
          if (isContinue) continueText = 'True';
          if (!liquidVariant && v.policy === undefined) continueText = 'Unknown (Hidden by Theme)';

          // For OOS: use liquidVariant.oos if available (most accurate), else fall back to qty
          let hasNoStock = false;
          let isStockHidden = false;

          if (liquidVariant && typeof liquidVariant.oos !== 'undefined') {
            hasNoStock = liquidVariant.oos === true;
          } else {
            const stockQty = v.qty !== undefined && v.qty !== null ? v.qty : null;
            if (stockQty === null) {
              isStockHidden = true;
            } else {
              hasNoStock = stockQty <= 0;
            }
          }

          const willShowPreorder = hasNoStock && isContinue;

          const displayTitle = v.title === 'Default Title' ? 'Single Product' : v.title;
          header.innerHTML = `<span> Variant: ${displayTitle}</span> `;

          const goToBtn = document.createElement('button');
          goToBtn.className = 'highlight-btn';
          goToBtn.textContent = 'Go to variant';
          goToBtn.style.padding = '2px 8px';
          goToBtn.onclick = () => {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              world: 'MAIN',
              function: (variantId) => {
                const url = new URL(window.location.href);
                url.searchParams.set('variant', variantId);
                window.location.href = url.toString();
              },
              args: [v.id]
            });
          };
          header.appendChild(goToBtn);

          const details = document.createElement('div');
          details.style.fontSize = '12px';
          details.style.marginTop = '4px';

          // Stock display: show qty from JSON, but note if using BIS oos flag
          const stockQtyDisplay = v.qty !== undefined && v.qty !== null ? v.qty : null;
          let stockDisplay;
          if (stockQtyDisplay !== null) {
            const stockColor = stockQtyDisplay <= 0 ? '#008060' : '#d82c0d';
            stockDisplay = `<span style = "color:${stockColor}; font-weight:bold;" > ${stockQtyDisplay}</span> `;
          } else if (liquidVariant && typeof liquidVariant.oos !== 'undefined') {
            const oosColor = liquidVariant.oos ? '#008060' : '#d82c0d';
            stockDisplay = `<span style = "color:${oosColor}; font-weight:bold;" > ${liquidVariant.oos ? 'OOS' : 'In Stock'}</span> `;
          } else {
            // Explicitly report it is hidden
            stockDisplay = `<span style = "color:#b98900; font-weight:bold;" > Unknown(Hidden by Theme)</span> `;
          }

          const continueColor = (isContinue || continueText === 'True') ? '#008060' : (continueText.includes('Unknown') ? '#b98900' : '#d82c0d');
          const continueDisplay = `<span style = "color:${continueColor}; font-weight:bold;" > ${continueText}</span> `;

          let invTrackingText = (v.management === 'shopify' || v.management === true || v.management === 'true') ? 'True' : 'False';
          if (!liquidVariant && v.management === null) invTrackingText = 'Unknown (Hidden by Theme)';

          const invColor = invTrackingText === 'True' ? '#008060' : (invTrackingText.includes('Unknown') ? '#b98900' : '#d82c0d');
          const invTrackingDisplay = `<span style = "color:${invColor}; font-weight:bold;" > ${invTrackingText}</span> `;

          details.innerHTML = `
          <strong> Stock:</strong> ${stockDisplay}<br/>
          <strong>Inventory Tracking:</strong> ${invTrackingDisplay}<br/>
          <strong>Continue Selling When OOS:</strong> ${continueDisplay} <br />
        `;

          // Determine if data is too masked to evaluate correctly
          const isUnverifiable = data.noLiquidHelper && (isStockHidden || continueText.includes('Unknown'));

          // Check for 'preorder-enabled' tag conditionally
          if (data.preorderSettings && data.preorderSettings.visibility === 'tagged') {
            let hasTag = false;
            if (data.liquidPreorderSettings && Array.isArray(data.liquidPreorderSettings.product_tags)) {
              hasTag = data.liquidPreorderSettings.product_tags.map(t => t.toLowerCase()).includes('preorder-enabled');
            }
            const tagColor = hasTag ? '#008060' : '#d82c0d';
            const tagDisplay = `<span style = "color:${tagColor}; font-weight:bold;" > ${hasTag ? 'True' : 'False'}</span> `;
            details.innerHTML += `<strong> Tagged with preorder - enabled:</strong> ${tagDisplay} <br />`;

            const willShowPreorderTagged = willShowPreorder && hasTag;

            // Output Logic
            if (data.isPreordersDisabledGlobally) {
              details.innerHTML += `
          <span style = "color:#d82c0d; font-size:11px;" >
                ❌ Preorder button will NOT show.<br/>
          <em>Reason: Preorders are toggled off globally.</em>
              </span>
          `;
            } else if (isUnverifiable) {
              details.innerHTML += `
          <span style = "color:#b98900; font-size:11px;" >
                ⚠️ Unverifiable.<br/>
          <em>Reason: Helper script is missing and theme hides inventory data in JSON.</em>
              </span>
          `;
            } else if (willShowPreorderTagged) {
              details.innerHTML += `
          <span style = "color:#008060; font-size:11px;" >
                ✅ Preorder button should be visible.
              </span>
          `;
            } else {
              const reasons = [];
              if (!hasNoStock && !isStockHidden) reasons.push("Product is in stock.");
              if (!isContinue && !continueText.includes('Unknown')) reasons.push("'Continue Selling When OOS' is false.");
              if (!hasTag) reasons.push("Missing 'preorder-enabled' tag.");

              if (reasons.length === 0 && isStockHidden) reasons.push("Stock data is hidden.");
              if (reasons.length === 0 && continueText.includes('Unknown')) reasons.push("Inventory policy is hidden.");

              details.innerHTML += `
          <span style = "color:#d82c0d; font-size:11px;" >
                ❌ Preorder button will NOT show.<br/>
          <em>Reasons: ${reasons.join(' ')}</em>
              </span>
          `;
            }
          } else {
            // Output Logic (Not Tagged)
            if (data.isPreordersDisabledGlobally) {
              details.innerHTML += `
          <span style = "color:#d82c0d; font-size:11px;" >
                ❌ Preorder button will NOT show.<br/>
          <em>Reason: Preorders are toggled off globally.</em>
              </span>
          `;
            } else if (isUnverifiable) {
              details.innerHTML += `
          <span style = "color:#b98900; font-size:11px;" >
                ⚠️ Unverifiable. <br/>
          <em>Reason: Helper script is missing and theme hides inventory data in JSON.</em>
              </span>
          `;
            } else if (willShowPreorder) {
              details.innerHTML += `
          <span style = "color:#008060; font-size:11px;" >
                ✅ Preorder button should be visible.
              </span>
          `;
            } else {
              const reasons = [];
              if (!hasNoStock && !isStockHidden) reasons.push("Product is in stock.");
              if (!isContinue && !continueText.includes('Unknown')) reasons.push("'Continue Selling When OOS' is false.");

              if (reasons.length === 0 && isStockHidden) reasons.push("Stock data is hidden.");
              if (reasons.length === 0 && continueText.includes('Unknown')) reasons.push("Inventory policy is hidden.");

              details.innerHTML += `
          <span style = "color:#d82c0d; font-size:11px;" >
                ❌ Preorder button will NOT show.<br/>
          <em>Reasons: ${reasons.join(' ')}</em>
              </span>
          `;
            }
          }

          wrapper.appendChild(header);
          wrapper.appendChild(details);
          resultsDiv.appendChild(wrapper);
        });

        // Render Preorder Script Settings ONLY if not globally disabled and helper exists
        if (data.preorderSettings) {
          const settingsWrapper = document.createElement('div');
          settingsWrapper.className = 'item-wrapper';
          settingsWrapper.style.marginTop = '15px';
          settingsWrapper.style.padding = '10px';
          settingsWrapper.style.backgroundColor = '#f4f6f8';
          settingsWrapper.style.border = '1px solid #dfe3e8';
          settingsWrapper.style.borderRadius = '3px';

          const settingsHeader = document.createElement('div');
          settingsHeader.className = 'item-header';
          settingsHeader.innerHTML = `<span style = "font-weight: bold; color: #202223;" >⚙️ Preorder Settings</span> `;
          settingsHeader.style.marginBottom = '8px';

          const settingsDetails = document.createElement('div');
          settingsDetails.style.fontSize = '12px';

          let settingsHtml = '';
          const config = data.preorderSettings;
          const { purchases_enabled, visibility, custom_button_copy, product_page_copy } = config;

          // Check if preorders are completely disabled/empty
          if (purchases_enabled === false && visibility === null && custom_button_copy === null && product_page_copy === null) {
            settingsHtml = '<em style="color:#d82c0d; font-weight:bold;">Preorder not enabled</em>';
          } else {
            // Visibility mapping
            let visText = visibility;
            if (visibility === 'all') visText = 'All out-of-stock products';
            if (visibility === 'tagged') visText = 'Only out-of-stock products with tag preorder-enabled';
            settingsHtml += `<strong> Preorder Button Visibility:</strong> <span style="color:#6d7175;">${visText || 'null'}</span><br/>`;

            // Custom Button Copy mapping
            settingsHtml += `<strong> Preorder Button Label / Caption:</strong> <span style="color:#6d7175;">${custom_button_copy || 'null'}</span><br/>`;

            // Product Page Copy mapping
            settingsHtml += `<strong> Preorder Message:</strong> <span style="color:#6d7175;">${product_page_copy || 'null'}</span><br/>`;



        // Dump any other unhandled keys just so Tier 2 can see raw data
            const handledKeys = ['purchases_enabled', 'visibility', 'custom_button_copy', 'product_page_copy'];
            let extraKeysHtml = '';
            for (const [key, value] of Object.entries(config)) {
              if (!handledKeys.includes(key) && value !== null) {
                extraKeysHtml += `<strong> ${key}:</strong> <span style="color:#6d7175;">${value}</span><br/>`;
              }
            }
            if (extraKeysHtml) {
              settingsHtml += `<em> Other Script Variables:</em> <br />${extraKeysHtml} `;
            }
          }

          settingsDetails.innerHTML = settingsHtml;

          settingsWrapper.appendChild(settingsHeader);
          settingsWrapper.appendChild(settingsDetails);
          resultsDiv.appendChild(settingsWrapper);
        }
      }

    } else {
      showPreorderError('No variant data returned.');
    }
  });
});

// ----------------------------------------------------
// New: Check for Updates Functionality
// ----------------------------------------------------
document.getElementById('checkUpdatesBtn').addEventListener('click', async () => {
  const btn = document.getElementById('checkUpdatesBtn');
  const resultsDiv = document.getElementById('updateResults');

  btn.textContent = 'Checking...';
  btn.disabled = true;
  resultsDiv.innerHTML = '';
  resultsDiv.classList.add('hidden');

  try {
    const response = await fetch('https://api.github.com/repos/jall-amp/amp-bis-checker/releases/latest');
    if (!response.ok) {
      throw new Error('Failed to fetch latest release from GitHub.');
    }

    const releaseData = await response.json();
    const latestVersion = releaseData.tag_name; // e.g., 'v1.2' or '1.2'
    const cleanLatestVersion = latestVersion.replace(/^v/, ''); // remove 'v' prefix if present
    
    // Get current version from manifest.json
    const manifest = chrome.runtime.getManifest();
    const currentVersion = manifest.version;

    resultsDiv.classList.remove('hidden');
    resultsDiv.style.marginTop = '12px';

    if (currentVersion === cleanLatestVersion || currentVersion > cleanLatestVersion) {
      // Up to date
      resultsDiv.innerHTML = `
        <div style="padding: 10px; background-color: #e3f1df; border-left: 4px solid #008060; font-size: 12px;">
          <strong>Up to date!</strong><br/>
          You are running version ${currentVersion}.
        </div>
      `;
    } else {
      // Update available
      let zipUrl = '';
      if (releaseData.assets && releaseData.assets.length > 0) {
        const zipAsset = releaseData.assets.find(a => a.name === 'bischecker.zip' || a.name.endsWith('.zip'));
        if (zipAsset) {
          zipUrl = zipAsset.browser_download_url;
        }
      }
      
      if (!zipUrl) {
         // Fallback to source code zip if no explicit asset was uploaded
         zipUrl = releaseData.zipball_url;
      }

      resultsDiv.innerHTML = `
        <div style="padding: 10px; background-color: #f4f6f8; border-left: 4px solid #006fbb; font-size: 12px;">
          <strong>Update Available! (v${cleanLatestVersion})</strong><br/>
          <span style="color: #6d7175; display: inline-block; margin-top: 4px;">
            Your version: ${currentVersion}
          </span>
          <div style="margin-top: 8px;">
            <a href="${zipUrl}" target="_blank" style="display: inline-block; text-decoration: none; padding: 6px 10px; background-color: #006fbb; color: white; border-radius: 4px; font-weight: bold; font-size: 11px;">
              Download ZIP
            </a>
          </div>
          <div style="margin-top: 8px; font-size: 11px; color: #6d7175;">
            <strong>How to update:</strong> Extract the ZIP and replace the existing files in your local extension folder. Then go to <code>chrome://extensions</code> and click the "Reload" icon for this extension.
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Update check error:', error);
    resultsDiv.classList.remove('hidden');
    resultsDiv.style.marginTop = '12px';
    resultsDiv.innerHTML = `
      <div style="padding: 10px; background-color: #ffeef0; border-left: 4px solid #d82c0d; font-size: 12px;">
        <strong>Error checking for updates.</strong><br/>
        Please try again later.
      </div>
    `;
  } finally {
    btn.textContent = 'Check for Updates';
    btn.disabled = false;
  }
});
