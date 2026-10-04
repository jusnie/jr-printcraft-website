"use strict";

/* ========================================================================
 * THIRD-PARTY SERVICE CONFIG now lives in supabase-config.js (loaded
 * before this file in index.html) so the storefront and admin.html share
 * one single set of credentials. See that file for setup instructions.
 * ====================================================================== */

const OWNER_EMAIL = "jr.printcraftexpress@gmail.com";

// Fallback design list used instantly on page load (and whenever Supabase
// isn't configured or the fetch fails) so the Ceramic Ornament card never
// shows a blank/broken "Look" row. loadOrnamentDesigns() then asks
// Supabase's "ornament_designs" table for the owner's real, fully
// add/rename/remove-able design list and re-renders with that instead --
// mirrors the DEFAULT_PRODUCTS / loadLiveProducts() pattern above.
const DEFAULT_ORNAMENT_DESIGNS = [
  { label: "Circle", image_url: "ornament-1.jpg" },
  { label: "Star", image_url: "ornament-2.jpg" },
  { label: "Snowflake", image_url: "ornament-3.jpg" },
  { label: "Heart", image_url: "ornament-4.jpg" }
];

let ornamentDesigns = DEFAULT_ORNAMENT_DESIGNS.slice();

let selectedDesignImage = "";
let selectedDesignFileName = "";
let selectedOrnamentDesignLabel = "";
let currentCustomizeProduct = null;

const cart = [];

function money(value) {
  return "CAD " + Number(value).toFixed(2);
}

/* ========================================================================
 * PRODUCT CATALOG RENDERING
 * ------------------------------------------------------------------------
 * The product grid is rendered entirely from JavaScript so the owner can
 * add, rename, reprice, or remove products from admin.html without ever
 * touching this file or index.html. DEFAULT_PRODUCTS below is the
 * fallback catalog used instantly on page load (and whenever Supabase
 * isn't configured or the fetch fails), so the storefront never shows a
 * blank grid or breaks. loadLiveProducts() then asks Supabase's
 * "products" table for the real, owner-managed catalog and -- if it
 * answers -- re-renders the grid with that data instead.
 * ====================================================================== */
// Fixed size option sets a product can be configured with (set per-product
// via size_type in Supabase / the admin dashboard's "Add Product" form).
// "drinkware" covers beer glasses, tumblers, and mugs; "apparel" covers
// shirts; "none" means no size selector at all (ornaments, notebooks, etc.).
const SIZE_OPTIONS_BY_TYPE = {
  drinkware: ["12oz", "16oz", "22oz"],
  apparel: ["Small", "Medium", "Large", "XL"]
};

const DEFAULT_PRODUCTS = [
  {
    key: "frostedBeer",
    name: "Frosted Beer",
    price: 20,
    image_url: "frosted-beer-16oz.jpg",
    description:
      "A personalized frosted beer glass for gifts, events, or premium drinkware branding.",
    size_type: "drinkware",
    sizes: [
      { label: "12oz", available: true },
      { label: "16oz", available: false },
      { label: "22oz", available: false }
    ]
  },
  {
    key: "ornament",
    name: "Ceramic Ornaments",
    price: 6,
    image_url: "ornament-1.jpg",
    description: "Holiday or souvenir ornaments with swappable design shapes to choose from.",
    size_type: "none",
    sizes: []
  },
  {
    key: "tshirtFront",
    name: "Tshirt - Front Only",
    price: 20,
    image_url: "tshirt-front.jpg",
    description: "Clean front-print shirt for everyday wear, teams, and promo use.",
    size_type: "apparel",
    sizes: [
      { label: "Small", available: true },
      { label: "Medium", available: true },
      { label: "Large", available: true },
      { label: "XL", available: true }
    ]
  },
  {
    key: "tshirtFrontBack",
    name: "Tshirt - Front and Back",
    price: 24,
    image_url: "tshirt-front-back.jpg",
    description: "Full custom shirt with front and back printing.",
    size_type: "apparel",
    sizes: [
      { label: "Small", available: true },
      { label: "Medium", available: true },
      { label: "Large", available: true },
      { label: "XL", available: true }
    ]
  },
  {
    key: "tumbler40",
    name: "Sublimation White Travel Tumbler",
    price: 40,
    image_url: "40oz-sublimation-white-tumbler.jpg",
    description: "Large travel tumbler with premium sublimation finish.",
    size_type: "drinkware",
    sizes: [
      { label: "12oz", available: false },
      { label: "16oz", available: false },
      { label: "22oz", available: true }
    ]
  },
  {
    key: "pickleballCover",
    name: "Neoprene Cover for Pickleball Paddle",
    price: 15,
    image_url: "pickleball-paddle-cover.jpg",
    description: "Protective neoprene cover for pickleball players.",
    size_type: "none",
    sizes: []
  },
  {
    key: "fabricNotebook",
    name: "Fabric Notebook",
    price: 20,
    image_url: "fabric-notebook.jpg",
    description: "Elegant notebook with a fabric cover.",
    size_type: "none",
    sizes: []
  },
  {
    key: "steelTumbler",
    name: "Stainless Steel White Tumbler",
    price: 25,
    image_url: "stainless-steel-white-tumbler.jpg",
    description: "Classic white tumbler for clean custom designs.",
    size_type: "drinkware",
    sizes: [
      { label: "12oz", available: true },
      { label: "16oz", available: true },
      { label: "22oz", available: true }
    ]
  }

];

// Keyed lookup of the currently-rendered catalog, kept in sync by
// renderProductGrid() every time it (re)builds the grid. openCustomizeModal()
// reads from this to know which size options (if any) to offer, since the
// customize buttons themselves only carry key/name/price in their dataset.
let currentProductsByKey = {};

// Supabase returns the "sizes" jsonb column already parsed into a JS array,
// but this tolerates a raw JSON string too (e.g. if ever hand-edited in the
// Supabase table editor) and always returns a clean, safe array.
function normalizeSizes(sizes) {
  let list = sizes;

  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch (err) {
      list = [];
    }
  }

  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .filter(function (item) { return item && item.label; })
    .map(function (item) {
      return { label: String(item.label), available: item.available !== false };
    });
}

function renderProductGrid(products) {
  const grid = document.getElementById("productGrid");
  const template = document.getElementById("productCardTemplate");
  const noResults = document.getElementById("noResults");

  if (!grid || !template || !Array.isArray(products)) {
    return;
  }

  grid.innerHTML = "";
  currentProductsByKey = {};

  products.forEach(function (product) {
    if (!product || !product.key || !product.name) {
      return;
    }

    currentProductsByKey[product.key] = {
      sizeType: product.size_type || "none",
      sizes: normalizeSizes(product.sizes)
    };

    const card = template.content.firstElementChild.cloneNode(true);

    const img = card.querySelector("img");
    const nameEl = card.querySelector("h3");
    const priceEl = card.querySelector(".price");
    const descEl = card.querySelector(".desc");
    const customizeBtn = card.querySelector(".customize-btn");
    const ornamentActions = card.querySelector(".ornament-actions");
    const numericPrice = Number(product.price) || 0;

    if (img) {
      img.src = product.image_url || "";
      img.alt = product.name + " product image";
    }

    if (nameEl) {
      nameEl.textContent = product.name;
    }

    if (priceEl) {
      priceEl.textContent = Number.isInteger(numericPrice)
        ? "CAD " + numericPrice
        : money(numericPrice);
    }

    if (descEl) {
      descEl.textContent = product.description || "";
    }

    if (customizeBtn) {
      customizeBtn.dataset.productKey = product.key;
      customizeBtn.dataset.productName = product.name;
      customizeBtn.dataset.productPrice = String(numericPrice);
    }

    // "Ceramic Ornaments" is special-cased with swappable "Look" buttons --
    // one per design in the owner-managed ornamentDesigns list (see
    // renderOrnamentLookButtons()/swapOrnament() above), on top of its
    // normal product-grid card.
    if (product.key === "ornament") {
      if (img) {
        img.id = "ornamentImage";

        if (ornamentDesigns.length) {
          img.src = ornamentDesigns[0].image_url || img.src;
        }
      }

      if (ornamentActions) {
        ornamentActions.hidden = false;
        renderOrnamentLookButtons(ornamentActions);
      }
    } else if (ornamentActions) {
      // Every other product doesn't need the 4 "Look" buttons at all --
      // remove the block entirely instead of just hiding it.
      ornamentActions.remove();
    }

    grid.appendChild(card);
  });

  if (noResults) {
    noResults.hidden = grid.querySelectorAll(".product-card").length !== 0;
  }
}

async function loadLiveProducts() {
  const client = getSupabaseClient();

  if (!client) {
    return;
  }

  try {
    const { data, error } = await client
      .from(SUPABASE_PRODUCTS_TABLE)
      .select("key, name, price, image_url, description, size_type, sizes, sort_order")
      .order("sort_order", { ascending: true });

    if (error || !data) {
      console.warn("Could not load live product data:", error);
      return;
    }

    // Supabase is reachable and configured, so it is the source of truth
    // for the catalog -- including the owner adding or removing products
    // from the admin dashboard. We re-render with whatever it returns
    // (even zero rows, if the owner emptied the catalog) instead of
    // silently keeping the hardcoded fallback list.
    renderProductGrid(data);
    connectScrollReveal(document.getElementById("productGrid"));
  } catch (err) {
    console.warn("Could not load live product data:", err);
  }
}

/* ========================================================================
 * LIVE SITE BRANDING/GALLERY IMAGES FROM SUPABASE
 * ------------------------------------------------------------------------
 * Same idea as loadLiveProductData() above, but for the logo, hero photo,
 * and the 4 showcase gallery photos -- editable from the admin dashboard's
 * "Branding & Gallery" section. Matched by [data-asset-key="..."] on each
 * <img>. Fails silently if Supabase isn't configured or the fetch errors.
 * ====================================================================== */
async function loadLiveSiteAssets() {
  const client = getSupabaseClient();

  if (!client) {
    return;
  }

  try {
    const { data, error } = await client
      .from(SUPABASE_SITE_ASSETS_TABLE)
      .select("key, image_url");

    if (error || !data) {
      console.warn("Could not load live site assets:", error);
      return;
    }

    data.forEach(function (row) {
      if (!row || !row.key || !row.image_url) {
        return;
      }

      document
        .querySelectorAll('[data-asset-key="' + row.key + '"]')
        .forEach(function (el) {
          el.src = row.image_url;
        });

      const lookIndex = ORNAMENT_LOOK_ASSET_KEYS.indexOf(row.key);

      if (lookIndex !== -1) {
        ornamentImages[lookIndex] = row.image_url;
      }
    });
  } catch (err) {
    console.warn("Could not load live site assets:", err);
  }
}

/* ========================================================================
 * LIVE "REVIEWS" SECTION FROM SUPABASE
 * ------------------------------------------------------------------------
 * The Reviews section is populated from real customer feedback that the
 * owner has approved (toggled "Publish as review" in admin.html) -- it
 * reads the public.published_reviews view (SUPABASE_REVIEWS_TABLE), which
 * only ever exposes approved rows and never includes an email address.
 * If Supabase isn't configured, or there are no published reviews yet, the
 * section falls back to the friendly "No reviews yet" message already in
 * the page instead of an empty grid.
 * ====================================================================== */
async function loadLiveReviews() {
  const grid = document.getElementById("reviewsGrid");
  const template = document.getElementById("reviewCardTemplate");
  const emptyMessage = document.getElementById("reviewsEmpty");
  const client = getSupabaseClient();

  if (!grid || !template) {
    return;
  }

  if (!client) {
    return;
  }

  try {
    const { data, error } = await client
      .from(SUPABASE_REVIEWS_TABLE)
      .select("id, name, rating, message, created_at, masked_email")
      .order("created_at", { ascending: false })
      .limit(24);

    if (error) {
      console.warn("Could not load live reviews:", error);
      return;
    }

    if (!data || !data.length) {
      return;
    }

    grid.innerHTML = "";

    data.forEach(function (row) {
      if (!row || !row.message) {
        return;
      }

      const card = template.content.firstElementChild.cloneNode(true);
      const starsEl = card.querySelector(".stars");
      const messageEl = card.querySelector("p");
      const nameEl = card.querySelector("strong");
      const maskedEmailEl = card.querySelector(".review-masked-email");
      const rating = Number(row.rating) || 0;

      if (starsEl) {
        starsEl.textContent = rating > 0
          ? "★".repeat(Math.min(rating, 5)) + "☆".repeat(Math.max(5 - rating, 0))
          : "★★★★★";
      }

      if (messageEl) {
        messageEl.textContent = "\u201c" + row.message + "\u201d";
      }

      if (nameEl) {
        nameEl.textContent = "- " + (row.name || "Happy Customer");
      }

      // The real email is never sent to the browser -- Supabase's
      // published_reviews view already masks it (e.g. "ja**@example.com")
      // before it ever leaves the database, via the mask_email() SQL
      // function. We just display whatever masked string comes back.
      if (maskedEmailEl) {
        if (row.masked_email) {
          maskedEmailEl.textContent = row.masked_email;
          maskedEmailEl.hidden = false;
        } else {
          maskedEmailEl.hidden = true;
        }
      }

      grid.appendChild(card);
    });

    if (emptyMessage) {
      emptyMessage.hidden = true;
    }

    connectScrollReveal(grid);
  } catch (err) {
    console.warn("Could not load live reviews:", err);
  }
}

/* ========================================================================
 * LIVE CERAMIC ORNAMENT DESIGNS FROM SUPABASE
 * ------------------------------------------------------------------------
 * Same idea as loadLiveProducts() above: DEFAULT_ORNAMENT_DESIGNS renders
 * instantly so the "Look" buttons never show blank/broken, then this asks
 * Supabase's ornament_designs table for the owner's real, fully owner-
 * managed list (added/renamed/removed from admin.html) and re-renders with
 * that instead. Fails silently if Supabase isn't configured or empty.
 * ====================================================================== */
async function loadOrnamentDesigns() {
  const client = getSupabaseClient();

  if (!client) {
    return;
  }

  try {
    const { data, error } = await client
      .from(SUPABASE_ORNAMENT_DESIGNS_TABLE)
      .select("label, image_url")
      .order("sort_order", { ascending: true });

    if (error || !data || !data.length) {
      console.warn("Could not load live ornament designs:", error);
      return;
    }

    ornamentDesigns = data
      .filter(function (row) { return row && row.label; })
      .map(function (row) {
        return { label: row.label, image_url: row.image_url || "" };
      });

    if (!ornamentDesigns.length) {
      return;
    }

    document.querySelectorAll(".ornament-actions").forEach(function (container) {
      renderOrnamentLookButtons(container);
    });

    const ornamentImageEl = document.getElementById("ornamentImage");

    if (ornamentImageEl && ornamentDesigns[0]) {
      ornamentImageEl.src = ornamentDesigns[0].image_url;
    }

    // If the customer already has the Customize modal open on the Ceramic
    // Ornament product, refresh its Design dropdown with the live list too.
    if (currentCustomizeProduct && currentCustomizeProduct.key === "ornament") {
      populateCustomizeDesignOptions("ornament");
    }
  } catch (err) {
    console.warn("Could not load live ornament designs:", err);
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Builds one button per design in the ornamentDesigns list inside the given
// ".ornament-actions" container (there's normally just one, on the Ceramic
// Ornament product card, but this re-runs for every matching container so
// a page with more than one never falls out of sync). Called whenever the
// list is (re)rendered: the initial product-grid render, and again once
// loadOrnamentDesigns() resolves with the owner's live list from Supabase.
function renderOrnamentLookButtons(container) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  ornamentDesigns.forEach(function (design, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mini-btn ornament-look-btn";
    button.dataset.lookIndex = String(index);
    button.textContent = design.label || "Design " + (index + 1);
    container.appendChild(button);
  });
}

function swapOrnament(index) {
  const image = document.getElementById("ornamentImage");
  const design = ornamentDesigns[index];

  if (!image || !design) {
    return;
  }

  selectedDesignImage = design.image_url || "";
  selectedDesignFileName = selectedDesignImage ? selectedDesignImage.split("/").pop() : "";
  selectedOrnamentDesignLabel = design.label || "";

  image.src = selectedDesignImage;
  image.alt = "Ceramic ornament image - " + (design.label || index + 1);
}

function openCustomizeModal(key, name, price) {
  currentCustomizeProduct = {
    key: key,
    name: name,
    price: Number(price)
  };

  const nameElement = document.getElementById("customizeProductName");
  const priceElement = document.getElementById("customizeProductPrice");
  const colorElement = document.getElementById("customizeColor");
  const textElement = document.getElementById("customizeText");
  const notesElement = document.getElementById("customizeNotes");
  const uploadElement = document.getElementById("customizeDesignUpload");
  const qtyElement = document.getElementById("customizeQty");

  if (nameElement) {
    nameElement.textContent = name;
  }

  if (priceElement) {
    priceElement.textContent = money(price);
  }

  populateCustomizeSizeOptions(key);
  populateCustomizeDesignOptions(key);

  if (colorElement) {
    colorElement.selectedIndex = 0;
  }

  if (textElement) {
    textElement.value = "";
  }

  if (notesElement) {
    notesElement.value = "";
  }

  if (uploadElement) {
    uploadElement.value = "";
  }

  if (qtyElement) {
    qtyElement.value = "1";
  }

  if (key !== "ornament") {
    selectedDesignImage = "";
    selectedDesignFileName = "";
    selectedOrnamentDesignLabel = "";
  }

  resetUploadUI();

  updateCustomizeTotal();
  openModal("customizeModal");
}

// Builds the Customize modal's Size dropdown for whichever product was just
// clicked, using that product's size_type/sizes from currentProductsByKey
// (populated by renderProductGrid()). Products with size_type "none" hide
// the Size field entirely. Sizes the owner has marked unavailable from the
// admin dashboard still show in the list (so customers can see what's
// normally offered) but are disabled and labeled "(Not Available)".
function populateCustomizeSizeOptions(key) {
  const sizeField = document.getElementById("customizeSizeField");
  const sizeElement = document.getElementById("customizeSize");

  if (!sizeElement) {
    return;
  }

  const info = currentProductsByKey[key];
  const sizeType = info ? info.sizeType : "none";

  sizeElement.innerHTML = "";

  if (!sizeType || sizeType === "none" || !SIZE_OPTIONS_BY_TYPE[sizeType]) {
    if (sizeField) {
      sizeField.hidden = true;
    }
    return;
  }

  const definedSizes = info.sizes && info.sizes.length
    ? info.sizes
    : SIZE_OPTIONS_BY_TYPE[sizeType].map(function (label) {
        return { label: label, available: true };
      });

  let firstAvailableSet = false;

  definedSizes.forEach(function (size) {
    const option = document.createElement("option");
    option.value = size.label;
    option.textContent = size.available
      ? size.label
      : size.label + " (Not Available)";
    option.disabled = !size.available;
    sizeElement.appendChild(option);

    if (size.available && !firstAvailableSet) {
      option.selected = true;
      firstAvailableSet = true;
    }
  });

  if (sizeField) {
    sizeField.hidden = false;
  }
}

// Builds the Customize modal's "Ornament Design" dropdown -- ONLY shown for
// the Ceramic Ornament product (key === "ornament"), letting the customer
// pick which shape/design (e.g. Circle, Star, Snowflake, Heart, or however
// many the owner has added from admin.html) they want for this order. Every
// other product hides this field entirely.
function populateCustomizeDesignOptions(key) {
  const designField = document.getElementById("customizeDesignField");
  const designElement = document.getElementById("customizeDesign");

  if (!designElement) {
    return;
  }

  if (key !== "ornament" || !ornamentDesigns.length) {
    if (designField) {
      designField.hidden = true;
    }
    designElement.innerHTML = "";
    return;
  }

  designElement.innerHTML = "";

  let preselectIndex = 0;

  ornamentDesigns.forEach(function (design, index) {
    const option = document.createElement("option");
    option.value = design.label;
    option.textContent = design.label;
    designElement.appendChild(option);

    if (selectedOrnamentDesignLabel && design.label === selectedOrnamentDesignLabel) {
      preselectIndex = index;
    }
  });

  designElement.selectedIndex = preselectIndex;

  if (designField) {
    designField.hidden = false;
  }
}

function resetUploadUI() {
  const fileNameElement = document.getElementById("customizeUploadFileName");
  const previewBox = document.getElementById("customizeUploadPreview");
  const previewImg = document.getElementById("customizeUploadThumb");
  const removeBtn = document.getElementById("customizeUploadRemove");

  if (fileNameElement) {
    fileNameElement.textContent = "No file chosen";
  }

  if (previewBox) {
    previewBox.hidden = true;
  }

  if (previewImg) {
    previewImg.src = "";
  }

  if (removeBtn) {
    removeBtn.hidden = true;
  }

  setUploadBusy(false);
}

function updateUploadUI(fileName, imageDataUrl) {
  const fileNameElement = document.getElementById("customizeUploadFileName");
  const previewBox = document.getElementById("customizeUploadPreview");
  const previewImg = document.getElementById("customizeUploadThumb");
  const removeBtn = document.getElementById("customizeUploadRemove");

  if (fileNameElement) {
    fileNameElement.textContent = fileName;
  }

  if (previewImg && imageDataUrl) {
    previewImg.src = imageDataUrl;
  }

  if (previewBox) {
    previewBox.hidden = !imageDataUrl;
  }

  if (removeBtn) {
    removeBtn.hidden = false;
  }
}

function updateCustomizeTotal() {
  const qtyElement = document.getElementById("customizeQty");
  const totalElement = document.getElementById("customizeItemTotal");

  if (!currentCustomizeProduct || !qtyElement || !totalElement) {
    return;
  }

  let quantity = parseInt(qtyElement.value, 10);

  if (Number.isNaN(quantity) || quantity < 1) {
    quantity = 1;
  }

  totalElement.textContent = money(currentCustomizeProduct.price * quantity);
}

function setCustomizeQty(change) {
  const qtyElement = document.getElementById("customizeQty");

  if (!qtyElement) {
    return;
  }

  let quantity = parseInt(qtyElement.value, 10);

  if (Number.isNaN(quantity) || quantity < 1) {
    quantity = 1;
  }

  quantity += change;

  if (quantity < 1) {
    quantity = 1;
  }

  qtyElement.value = String(quantity);
  updateCustomizeTotal();
}

function addCustomizeItemToCart() {
  if (!currentCustomizeProduct) {
    return;
  }

  const qtyElement = document.getElementById("customizeQty");
  const sizeElement = document.getElementById("customizeSize");
  const designElement = document.getElementById("customizeDesign");
  const designField = document.getElementById("customizeDesignField");
  const colorElement = document.getElementById("customizeColor");
  const textElement = document.getElementById("customizeText");
  const notesElement = document.getElementById("customizeNotes");

  let quantity = qtyElement ? parseInt(qtyElement.value, 10) : 1;

  if (Number.isNaN(quantity) || quantity < 1) {
    quantity = 1;
  }

  const designPicked = designElement && designField && !designField.hidden
    ? designElement.value
    : "";

  cart.push({
    name: currentCustomizeProduct.name,
    price: currentCustomizeProduct.price,
    quantity: quantity,
    size: sizeElement ? sizeElement.value : "",
    design: designPicked,
    color: colorElement ? colorElement.value : "",
    customText: textElement ? textElement.value : "",
    notes: notesElement ? notesElement.value : "",
    designImage: selectedDesignImage,
    designName: selectedDesignFileName
  });

  renderCart();
  setOrderStatus(null);
  closeAllModals();

  currentCustomizeProduct = null;
}

function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
}

function updateCartGrandTotal() {
  const grandTotalBox = document.getElementById("cartGrandTotal");
  const grandTotalValue = document.getElementById("cartGrandTotalValue");
  const itemCountLabel = document.getElementById("cartItemCount");
  const sendOrderBtn = document.getElementById("sendOrderBtn");
  const emptyCartNote = document.getElementById("emptyCartNote");

  if (cart.length === 0) {
    if (grandTotalBox) {
      grandTotalBox.hidden = true;
    }

    if (sendOrderBtn) {
      sendOrderBtn.disabled = true;
    }

    if (emptyCartNote) {
      emptyCartNote.hidden = false;
    }

    return;
  }

  if (sendOrderBtn) {
    sendOrderBtn.disabled = false;
  }

  if (emptyCartNote) {
    emptyCartNote.hidden = true;
  }

  if (!grandTotalBox || !grandTotalValue || !itemCountLabel) {
    return;
  }

  const totalQuantity = cart.reduce(function (sum, item) {
    return sum + item.quantity;
  }, 0);

  const grandTotal = cart.reduce(function (sum, item) {
    return sum + item.price * item.quantity;
  }, 0);

  grandTotalBox.hidden = false;
  grandTotalValue.textContent = money(grandTotal);
  itemCountLabel.textContent =
    "(" + totalQuantity + (totalQuantity === 1 ? " item)" : " items)");
}

function renderCart() {
  const summary = document.getElementById("summaryPreview");

  if (!summary) {
    return;
  }

  if (cart.length === 0) {
    summary.classList.add("is-empty");
    summary.innerHTML =
      '<p style="color:#5a6779;">No items in cart yet.</p>';
    updateCartGrandTotal();
    return;
  }

  summary.classList.remove("is-empty");

  summary.innerHTML = cart
    .map(function (item, index) {
      const itemTotal = item.price * item.quantity;

      return `
        <div class="summary-item">
          <div class="summary-top">
            <div>
              <strong>${escapeHtml(item.name)}</strong>

              <div class="summary-line">
                Quantity: ${item.quantity}
              </div>

              <div class="summary-line">
                Price: ${money(item.price)}
              </div>

              <div class="summary-line">
                Total: ${money(itemTotal)}
              </div>

              ${item.size ? `
              <div class="summary-line">
                Size: ${escapeHtml(item.size)}
              </div>` : ""}

              <div class="summary-line">
                Color: ${escapeHtml(item.color)}
              </div>

              <div class="summary-line">
                Custom text: ${escapeHtml(item.customText || "N/A")}
              </div>

              <div class="summary-line">
                Notes: ${escapeHtml(item.notes || "N/A")}
              </div>

              <button
                type="button"
                class="mini-btn remove-cart-button"
                data-index="${index}">
                Remove
              </button>
            </div>

            <strong>${money(itemTotal)}</strong>
          </div>
        </div>
      `;
    })
    .join("");

  const removeButtons = summary.querySelectorAll(".remove-cart-button");

  removeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      const index = Number(button.dataset.index);
      removeFromCart(index);
    });
  });

  updateCartGrandTotal();
}

function clearUploadedDesign() {
  const upload = document.getElementById("customizeDesignUpload");

  if (upload) {
    upload.value = "";
  }

  selectedDesignImage = "";
  selectedDesignFileName = "";
  resetUploadUI();
}

function setUploadBusy(isBusy, statusText) {
  const fileNameElement = document.getElementById("customizeUploadFileName");
  const addToCartBtn = document.getElementById("customizeAddToCart");
  const uploadBtn = document.getElementById("customizeUploadBtn");

  if (isBusy && fileNameElement) {
    fileNameElement.textContent = statusText || "Uploading...";
  }

  if (addToCartBtn) {
    addToCartBtn.disabled = isBusy;
  }

  if (uploadBtn) {
    uploadBtn.disabled = isBusy;
  }
}

function handleDesignUpload(file) {
  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    alert("Please upload an image file.");
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    alert("Image must be under 2MB. Please choose a smaller file.");
    clearUploadedDesign();
    return;
  }

  const client = getSupabaseClient();

  if (client) {
    uploadDesignToSupabase(client, file);
    return;
  }

  // Fallback while Supabase isn't configured yet: preview locally only.
  // Note: this local copy is NOT included in the order email (it would be
  // far too large to fit in a link), so set up Supabase to fix that.
  const reader = new FileReader();

  reader.onload = function () {
    selectedDesignImage = String(reader.result || "");
    selectedDesignFileName = file.name;
    updateUploadUI(file.name, selectedDesignImage);
  };

  reader.readAsDataURL(file);
}

function uploadDesignToSupabase(client, file) {
  setUploadBusy(true, "Uploading...");

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = Date.now() + "-" + safeName;

  client.storage
    .from(SUPABASE_DESIGNS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false
    })
    .then(function (result) {
      if (result.error) {
        throw result.error;
      }

      const publicUrlResult = client.storage
        .from(SUPABASE_DESIGNS_BUCKET)
        .getPublicUrl(path);

      const publicUrl =
        publicUrlResult && publicUrlResult.data
          ? publicUrlResult.data.publicUrl
          : "";

      selectedDesignImage = publicUrl;
      selectedDesignFileName = file.name;

      setUploadBusy(false);
      updateUploadUI(file.name, publicUrl);
    })
    .catch(function (error) {
      console.error("Supabase upload failed:", error);
      alert(
        "We couldn't upload your design image right now. You can still add this item without the design file, or try again."
      );
      setUploadBusy(false);
      clearUploadedDesign();
    });
}

function isDesignLinkAvailable(value) {
  return typeof value === "string" && value.indexOf("http") === 0;
}

function buildOrderDetails() {
  const nameElement = document.getElementById("customerName");
  const emailElement = document.getElementById("customerEmail");

  const customerName = nameElement ? nameElement.value.trim() : "";
  const customerEmail = emailElement ? emailElement.value.trim() : "";

  const orderNumber = "JRPC-" + Date.now();

  let itemsText = "No items in cart.";

  if (cart.length > 0) {
    itemsText = cart
      .map(function (item, index) {
        const designLine = isDesignLinkAvailable(item.designImage)
          ? "Design Image: " + item.designImage
          : "Design Image: None";

        const lines = [
          (index + 1) + ". " + item.name,
          "Quantity: " + item.quantity,
          "Price: " + money(item.price)
        ];

        if (item.size) {
          lines.push("Size: " + item.size);
        }

        if (item.design) {
          lines.push("Design: " + item.design);
        }

        lines.push(
          "Color: " + item.color,
          "Custom text: " + (item.customText || "N/A"),
          "Notes: " + (item.notes || "N/A"),
          designLine,
          "Item total: " + money(item.price * item.quantity)
        );

        return lines.join("\n");
      })
      .join("\n\n");
  }

  const orderTotal = cart.reduce(function (total, item) {
    return total + item.price * item.quantity;
  }, 0);

  const itemCount = cart.reduce(function (sum, item) {
    return sum + item.quantity;
  }, 0);

  const subject = "New Order " + orderNumber + " - " + customerName;

  const body = [
    "New Customer Order",
    "",
    "Order Number: " + orderNumber,
    "Customer Name: " + customerName,
    "Customer Email: " + customerEmail,
    "",
    "Items:",
    itemsText,
    "",
    "Order Total: " + money(orderTotal)
  ].join("\n");

  return {
    orderNumber: orderNumber,
    customerName: customerName,
    customerEmail: customerEmail,
    itemsText: itemsText,
    orderTotal: orderTotal,
    itemCount: itemCount,
    subject: subject,
    body: body
  };
}

function connectCustomizeButtons() {
  // Delegated on the grid container (not on individual buttons) so this
  // keeps working no matter how many times renderProductGrid() rebuilds
  // the cards inside it (e.g. once with defaults, then again with live
  // Supabase data, then again whenever the owner adds/removes products).
  const grid = document.getElementById("productGrid");

  if (!grid) {
    return;
  }

  grid.addEventListener("click", function (event) {
    const button = event.target.closest(".customize-btn");

    if (!button) {
      return;
    }

    event.preventDefault();

    const key = button.dataset.productKey;
    const name = button.dataset.productName;
    const price = button.dataset.productPrice;

    openCustomizeModal(key, name, price);
  });
}

function connectCustomizeModal() {
  const minusBtn = document.getElementById("customizeMinus");
  const plusBtn = document.getElementById("customizePlus");
  const qtyInput = document.getElementById("customizeQty");
  const addToCartBtn = document.getElementById("customizeAddToCart");
  const uploadInput = document.getElementById("customizeDesignUpload");
  const uploadBtn = document.getElementById("customizeUploadBtn");
  const uploadRemoveBtn = document.getElementById("customizeUploadRemove");

  if (uploadBtn) {
    uploadBtn.addEventListener("click", function (event) {
      event.preventDefault();

      if (uploadInput) {
        uploadInput.click();
      }
    });
  }

  if (uploadRemoveBtn) {
    uploadRemoveBtn.addEventListener("click", function (event) {
      event.preventDefault();
      clearUploadedDesign();
    });
  }

  if (minusBtn) {
    minusBtn.addEventListener("click", function (event) {
      event.preventDefault();
      setCustomizeQty(-1);
    });
  }

  if (plusBtn) {
    plusBtn.addEventListener("click", function (event) {
      event.preventDefault();
      setCustomizeQty(1);
    });
  }

  if (qtyInput) {
    qtyInput.addEventListener("input", updateCustomizeTotal);
  }

  if (addToCartBtn) {
    addToCartBtn.addEventListener("click", function (event) {
      event.preventDefault();
      addCustomizeItemToCart();
    });
  }

  if (uploadInput) {
    uploadInput.addEventListener("change", function () {
      handleDesignUpload(uploadInput.files[0]);
    });
  }
}

function connectOrnamentButtons() {
  // Delegated the same way as connectCustomizeButtons() above, since the
  // "Ceramic Ornaments" card (and its 4 Look buttons) is rebuilt from
  // scratch every time renderProductGrid() runs.
  const grid = document.getElementById("productGrid");

  if (!grid) {
    return;
  }

  grid.addEventListener("click", function (event) {
    const button = event.target.closest(".ornament-look-btn");

    if (!button) {
      return;
    }

    event.preventDefault();
    swapOrnament(Number(button.dataset.lookIndex));
  });
}

const COOKIE_CONSENT_KEY = "jrpcCookieConsent";

function openModal(modalId) {
  const modal = document.getElementById(modalId);

  if (!modal) {
    return;
  }

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");

  const anyOpen = document.querySelector(".modal-overlay.is-open");

  if (!anyOpen) {
    document.body.style.overflow = "";
  }
}

function closeAllModals() {
  document.querySelectorAll(".modal-overlay.is-open").forEach(function (modal) {
    closeModal(modal);
  });
}

function connectModals() {
  document.querySelectorAll("[data-open-modal]").forEach(function (trigger) {
    trigger.addEventListener("click", function (event) {
      event.preventDefault();
      openModal(trigger.dataset.openModal);
    });
  });

  document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) {
        closeModal(overlay);
      }
    });

    overlay.querySelectorAll("[data-close-modal]").forEach(function (button) {
      button.addEventListener("click", function () {
        closeModal(overlay);
      });
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeAllModals();
    }
  });
}

function connectCookieBanner() {
  const banner = document.getElementById("cookieBanner");

  if (!banner) {
    return;
  }

  let storedConsent = null;

  try {
    storedConsent = window.localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch (error) {
    storedConsent = null;
  }

  function reserveBannerSpace() {
    const height = banner.offsetHeight;
    document.body.style.paddingBottom = height + 24 + "px";
  }

  function releaseBannerSpace() {
    document.body.style.paddingBottom = "";
  }

  if (!storedConsent) {
    banner.hidden = false;

    window.setTimeout(function () {
      banner.classList.add("is-visible");
      reserveBannerSpace();
    }, 400);

    window.addEventListener("resize", function () {
      if (banner.classList.contains("is-visible")) {
        reserveBannerSpace();
      }
    });
  }

  function hideBanner(value) {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
    } catch (error) {
      // Ignore storage errors (e.g. private browsing mode).
    }

    banner.classList.remove("is-visible");
    releaseBannerSpace();

    window.setTimeout(function () {
      banner.hidden = true;
    }, 350);
  }

  const acceptButton = document.getElementById("cookieAccept");
  const declineButton = document.getElementById("cookieDecline");

  if (acceptButton) {
    acceptButton.addEventListener("click", function () {
      hideBanner("accepted");
    });
  }

  if (declineButton) {
    declineButton.addEventListener("click", function () {
      hideBanner("declined");
    });
  }
}

const PRODUCT_VIEW_KEY = "jrpcProductView";

function connectProductSearch() {
  const searchInput = document.getElementById("productSearch");
  const grid = document.getElementById("productGrid");
  const noResults = document.getElementById("noResults");

  if (!searchInput || !grid) {
    return;
  }

  searchInput.addEventListener("input", function () {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    // Queried fresh on every keystroke (rather than cached once at bind
    // time) because the grid is rebuilt by renderProductGrid() after the
    // live Supabase fetch resolves, and whenever the owner adds/removes
    // products.
    const cards = Array.prototype.slice.call(
      grid.querySelectorAll(".product-card")
    );

    cards.forEach(function (card) {
      const nameElement = card.querySelector("h3");
      const descElement = card.querySelector(".desc");

      const name = nameElement ? nameElement.textContent.toLowerCase() : "";
      const desc = descElement ? descElement.textContent.toLowerCase() : "";

      const matches =
        !query || name.indexOf(query) !== -1 || desc.indexOf(query) !== -1;

      card.classList.toggle("is-hidden", !matches);

      if (matches) {
        visibleCount += 1;
      }
    });

    if (noResults) {
      noResults.hidden = visibleCount !== 0;
    }
  });
}

function connectViewToggle() {
  const grid = document.getElementById("productGrid");
  const gridBtn = document.getElementById("gridViewBtn");
  const listBtn = document.getElementById("listViewBtn");

  if (!grid || !gridBtn || !listBtn) {
    return;
  }

  function setView(view) {
    const isList = view === "list";

    grid.classList.toggle("list-view", isList);
    gridBtn.classList.toggle("is-active", !isList);
    listBtn.classList.toggle("is-active", isList);
    gridBtn.setAttribute("aria-pressed", String(!isList));
    listBtn.setAttribute("aria-pressed", String(isList));

    try {
      window.localStorage.setItem(PRODUCT_VIEW_KEY, view);
    } catch (error) {
      // Ignore storage errors (e.g. private browsing mode).
    }
  }

  gridBtn.addEventListener("click", function () {
    setView("grid");
  });

  listBtn.addEventListener("click", function () {
    setView("list");
  });

  let storedView = "grid";

  try {
    storedView = window.localStorage.getItem(PRODUCT_VIEW_KEY) || "grid";
  } catch (error) {
    storedView = "grid";
  }

  setView(storedView);
}

function setOrderStatus(message, state) {
  const statusElement = document.getElementById("orderStatus");

  if (!statusElement) {
    return;
  }

  if (!message) {
    statusElement.hidden = true;
    statusElement.textContent = "";
    statusElement.className = "order-status";
    return;
  }

  statusElement.hidden = false;
  statusElement.textContent = message;
  statusElement.className = "order-status order-status-" + state;
}

function sendOrderViaMailto(details) {
  const mailto =
    "mailto:" + OWNER_EMAIL +
    "?subject=" +
    encodeURIComponent(details.subject) +
    "&body=" +
    encodeURIComponent(details.body);

  window.location.href = mailto;
}

function sendOrderViaEmailjs(details) {
  const sendOrderBtn = document.getElementById("sendOrderBtn");

  if (sendOrderBtn) {
    sendOrderBtn.disabled = true;
  }

  setOrderStatus("Sending your order...", "pending");

  const templateParams = {
    order_number: details.orderNumber,
    customer_name: details.customerName,
    customer_email: details.customerEmail,
    items_summary: details.itemsText,
    order_total: money(details.orderTotal),
    item_count: details.itemCount
  };

  window.emailjs
    .send(EMAILJS_ACCOUNT_1_SERVICE_ID, EMAILJS_ORDER_TEMPLATE_ID, templateParams, {
      publicKey: EMAILJS_ACCOUNT_1_PUBLIC_KEY
    })
    .then(function () {
      setOrderStatus(
        "Thank you! Your order has been sent. We'll contact you soon.",
        "success"
      );

      cart.length = 0;
      renderCart();

      const orderForm = document.getElementById("orderForm");

      if (orderForm) {
        orderForm.reset();
      }

      sendOrderAutoReplyEmail(templateParams);
    })
    .catch(function (error) {
      console.error("EmailJS send failed:", error);
      setOrderStatus(
        "Something went wrong sending your order. Please try again or contact us directly.",
        "error"
      );

      if (sendOrderBtn) {
        sendOrderBtn.disabled = cart.length === 0;
      }
    });
}

// Sends the customer their own "order received" confirmation email (Account
// 3), separate from the owner notification email above (Account 1). This is
// best-effort only: it never blocks or changes the success/error message
// shown to the customer, since the owner notification succeeding is what
// actually matters operationally -- a failure here is just logged.
function sendOrderAutoReplyEmail(templateParams) {
  if (!isOrderAutoReplyConfigured() || !window.emailjs || !templateParams.customer_email) {
    return;
  }

  window.emailjs
    .send(EMAILJS_ACCOUNT_3_SERVICE_ID, EMAILJS_ORDER_AUTOREPLY_TEMPLATE_ID, templateParams, {
      publicKey: EMAILJS_ACCOUNT_3_PUBLIC_KEY
    })
    .catch(function (error) {
      console.warn("Order auto-reply email failed to send:", error);
    });
}

function connectScrollReveal(root) {
  // Accepts an optional root element so a dynamic re-render of just the
  // product grid (after the live Supabase fetch resolves) can re-arm
  // reveal animations for its new cards only, without re-touching
  // elements elsewhere on the page that were already revealed.
  const scope = root || document;
  const revealEls = scope.querySelectorAll(".reveal");

  if (!revealEls.length) {
    return;
  }

  // Stagger reveal elements that share the same parent (cards in a grid,
  // rows in a list) so they cascade in one after another on scroll instead
  // of all popping in at the exact same instant.
  const siblingCounts = new Map();
  revealEls.forEach(function (el) {
    const parent = el.parentElement;
    const index = siblingCounts.get(parent) || 0;
    siblingCounts.set(parent, index + 1);
    el.style.transitionDelay = Math.min(index, 6) * 80 + "ms";
  });

  if (!("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
    return;
  }

  const observer = new IntersectionObserver(
    function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  revealEls.forEach(function (el) {
    observer.observe(el);
  });
}


/* ========================================================================
 * CUSTOMER FEEDBACK
 * ------------------------------------------------------------------------
 * Submits are saved to the Supabase "feedback" table (so the owner can
 * review them anytime in admin.html) AND emailed via EmailJS if that's
 * configured. If neither Supabase nor EmailJS is set up yet, it falls back
 * to opening a draft email to the owner, same pattern as order submission.
 * ====================================================================== */
function resetFeedbackStars() {
  document.querySelectorAll("#feedbackRating .star-btn").forEach(function (btn) {
    btn.classList.remove("is-active");
    btn.setAttribute("aria-pressed", "false");
  });

  const ratingInput = document.getElementById("feedbackRatingValue");
  if (ratingInput) ratingInput.value = "";
}

function wireFeedbackRatingStars() {
  const starButtons = document.querySelectorAll("#feedbackRating .star-btn");
  const ratingInput = document.getElementById("feedbackRatingValue");

  if (!starButtons.length || !ratingInput) {
    return;
  }

  starButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const value = Number(btn.dataset.value);
      ratingInput.value = value;

      starButtons.forEach(function (otherBtn) {
        const isActive = Number(otherBtn.dataset.value) <= value;
        otherBtn.classList.toggle("is-active", isActive);
        otherBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    });
  });
}

function setFeedbackStatus(message, state) {
  const statusElement = document.getElementById("feedbackStatus");

  if (!statusElement) {
    return;
  }

  if (!message) {
    statusElement.hidden = true;
    statusElement.textContent = "";
    statusElement.className = "order-status";
    return;
  }

  statusElement.hidden = false;
  statusElement.textContent = message;
  statusElement.className = "order-status order-status-" + state;
}

function sendFeedbackViaMailto(payload) {
  const lines = [
    "Name: " + (payload.name || "Not provided"),
    "Email: " + (payload.email || "Not provided"),
    "Rating: " + (payload.rating ? payload.rating + "/5" : "Not provided"),
    "",
    payload.message
  ];

  const mailto =
    "mailto:" + OWNER_EMAIL +
    "?subject=" +
    encodeURIComponent("New website feedback") +
    "&body=" +
    encodeURIComponent(lines.join("\n"));

  window.location.href = mailto;
}

function connectFeedbackForm() {
  wireFeedbackRatingStars();

  const feedbackForm = document.getElementById("feedbackForm");

  if (!feedbackForm) {
    return;
  }

  feedbackForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const submitBtn = document.getElementById("feedbackSubmitBtn");
    const messageField = document.getElementById("feedbackMessage");
    const message = messageField.value.trim();

    if (!message) {
      setFeedbackStatus("Please write a short message before sending.", "error");
      return;
    }

    const ratingValue = document.getElementById("feedbackRatingValue").value;

    const payload = {
      name: document.getElementById("feedbackName").value.trim(),
      email: document.getElementById("feedbackEmail").value.trim(),
      rating: ratingValue ? Number(ratingValue) : null,
      message: message
    };

    const supabaseClientForFeedback = getSupabaseClient();
    const emailjsReady = isFeedbackEmailConfigured() && window.emailjs;

    if (!supabaseClientForFeedback && !emailjsReady) {
      sendFeedbackViaMailto(payload);
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    setFeedbackStatus("Sending your feedback...", "pending");

    let savedOk = false;
    let emailedOk = false;

    if (supabaseClientForFeedback) {
      try {
        const { error } = await supabaseClientForFeedback
          .from(SUPABASE_FEEDBACK_TABLE)
          .insert({
            name: payload.name || null,
            email: payload.email || null,
            rating: payload.rating,
            message: payload.message
          });

        savedOk = !error;

        if (error) {
          console.warn("Could not save feedback:", error);
        }
      } catch (err) {
        console.warn("Could not save feedback:", err);
      }
    }

    if (emailjsReady) {
      try {
        await window.emailjs.send(
          EMAILJS_ACCOUNT_2_SERVICE_ID,
          EMAILJS_FEEDBACK_TEMPLATE_ID,
          {
            customer_name: payload.name || "Anonymous",
            customer_email: payload.email || "Not provided",
            rating: payload.rating ? payload.rating + "/5" : "Not provided",
            message: payload.message
          },
          { publicKey: EMAILJS_ACCOUNT_2_PUBLIC_KEY }
        );

        emailedOk = true;
      } catch (err) {
        console.warn("Could not email feedback:", err);
      }
    }

    if (submitBtn) submitBtn.disabled = false;

    if (savedOk || emailedOk) {
      setFeedbackStatus("Thank you! Your feedback has been sent.", "success");
      feedbackForm.reset();
      resetFeedbackStars();
    } else {
      setFeedbackStatus(
        "Something went wrong sending your feedback. Please try again or contact us directly.",
        "error"
      );
    }
  });
}

/* ========================================================================
 * CONTACT FORM
 * ------------------------------------------------------------------------
 * Sends straight to the owner via EmailJS (Account 1, same account as
 * orders). If EmailJS isn't configured yet, falls back to opening a draft
 * email in the visitor's own email app, same pattern as the order form.
 * ====================================================================== */
function setContactStatus(message, state) {
  const statusElement = document.getElementById("contactStatus");

  if (!statusElement) {
    return;
  }

  if (!message) {
    statusElement.hidden = true;
    statusElement.textContent = "";
    statusElement.className = "order-status";
    return;
  }

  statusElement.hidden = false;
  statusElement.textContent = message;
  statusElement.className = "order-status order-status-" + state;
}

function sendContactViaMailto(payload) {
  const body = "Name: " + payload.name + "\nEmail: " + payload.email + "\n\n" + payload.message;

  const mailto =
    "mailto:" + OWNER_EMAIL +
    "?subject=" +
    encodeURIComponent("Website contact message from " + payload.name) +
    "&body=" +
    encodeURIComponent(body);

  window.location.href = mailto;
}

function connectContactForm() {
  const contactForm = document.getElementById("contactForm");

  if (!contactForm) {
    return;
  }

  contactForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const submitBtn = document.getElementById("contactSubmitBtn");

    const payload = {
      name: document.getElementById("contactName").value.trim(),
      email: document.getElementById("contactEmail").value.trim(),
      message: document.getElementById("contactMessage").value.trim()
    };

    if (!payload.name || !payload.email || !payload.message) {
      setContactStatus("Please fill in your name, email, and message.", "error");
      return;
    }

    const emailjsReady = isContactEmailConfigured() && window.emailjs;

    if (!emailjsReady) {
      sendContactViaMailto(payload);
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    setContactStatus("Sending your message...", "pending");

    try {
      await window.emailjs.send(
        EMAILJS_ACCOUNT_1_SERVICE_ID,
        EMAILJS_CONTACT_TEMPLATE_ID,
        {
          customer_name: payload.name,
          customer_email: payload.email,
          message: payload.message
        },
        { publicKey: EMAILJS_ACCOUNT_1_PUBLIC_KEY }
      );

      setContactStatus("Thank you! Your message has been sent.", "success");
      contactForm.reset();
    } catch (err) {
      console.warn("Could not send contact message:", err);
      setContactStatus(
        "Something went wrong sending your message. Please try again or contact us directly.",
        "error"
      );
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  // Paint the known-good fallback catalog immediately so the grid is never
  // blank while we wait on the network, then connect interactions (which
  // are delegated on the grid container, so they work before AND after
  // the live re-render below).
  renderProductGrid(DEFAULT_PRODUCTS);

  connectCustomizeButtons();
  connectCustomizeModal();
  connectOrnamentButtons();
  connectModals();
  connectCookieBanner();
  connectProductSearch();
  connectViewToggle();
  connectScrollReveal();
  loadLiveProducts();
  loadLiveSiteAssets();
  loadLiveReviews();
  loadOrnamentDesigns();
  connectFeedbackForm();
  connectContactForm();

  const orderForm = document.getElementById("orderForm");

  if (orderForm) {
    orderForm.addEventListener("submit", function (event) {
      event.preventDefault();

      if (cart.length === 0) {
        alert(
          "Your cart is empty. Please customize and add at least one product before sending your order."
        );
        return;
      }

      const details = buildOrderDetails();

      if (isOrderEmailConfigured() && window.emailjs) {
        sendOrderViaEmailjs(details);
      } else {
        sendOrderViaMailto(details);
      }
    });
  }

  const navToggle = document.getElementById("nav-toggle");

  document.querySelectorAll(".mobile-menu a").forEach(function (link) {
    link.addEventListener("click", function () {
      if (navToggle) {
        navToggle.checked = false;
      }
    });
  });

  renderCart();
});