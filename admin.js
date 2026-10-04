"use strict";

const setupNeededEl = document.getElementById("setupNeeded");
const loginSection = document.getElementById("loginSection");
const forgotPasswordSection = document.getElementById("forgotPasswordSection");
const resetPasswordSection = document.getElementById("resetPasswordSection");
const dashboardSection = document.getElementById("dashboardSection");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginSubmit = document.getElementById("loginSubmit");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const forgotPasswordStatus = document.getElementById("forgotPasswordStatus");
const forgotPasswordSubmit = document.getElementById("forgotPasswordSubmit");
const backToLoginLink = document.getElementById("backToLoginLink");
const resetPasswordForm = document.getElementById("resetPasswordForm");
const resetPasswordStatus = document.getElementById("resetPasswordStatus");
const resetPasswordSubmit = document.getElementById("resetPasswordSubmit");
const logoutBtn = document.getElementById("logoutBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsOverlay = document.getElementById("settingsOverlay");
const settingsClose = document.getElementById("settingsClose");
const changePasswordForm = document.getElementById("changePasswordForm");
const changeEmailForm = document.getElementById("changeEmailForm");
const passwordMsg = document.getElementById("passwordMsg");
const emailMsg = document.getElementById("emailMsg");
const dashboardStatus = document.getElementById("dashboardStatus");
const adminProductGrid = document.getElementById("adminProductGrid");
const adminProductTemplate = document.getElementById("adminProductTemplate");
const addProductToggleBtn = document.getElementById("addProductToggleBtn");
const addProductForm = document.getElementById("addProductForm");
const addProductCancelBtn = document.getElementById("addProductCancelBtn");
const addProductStatus = document.getElementById("addProductStatus");
const newProductName = document.getElementById("newProductName");
const newProductPrice = document.getElementById("newProductPrice");
const newProductDescription = document.getElementById("newProductDescription");
const newProductSizeType = document.getElementById("newProductSizeType");
const newProductSizeChecks = document.getElementById("newProductSizeChecks");
const newProductPhoto = document.getElementById("newProductPhoto");
const assetsStatus = document.getElementById("assetsStatus");
const adminAssetGrid = document.getElementById("adminAssetGrid");
const adminAssetTemplate = document.getElementById("adminAssetTemplate");
const ornamentDesignsStatus = document.getElementById("ornamentDesignsStatus");
const adminOrnamentDesignGrid = document.getElementById("adminOrnamentDesignGrid");
const adminOrnamentDesignTemplate = document.getElementById("adminOrnamentDesignTemplate");
const addOrnamentDesignToggleBtn = document.getElementById("addOrnamentDesignToggleBtn");
const addOrnamentDesignForm = document.getElementById("addOrnamentDesignForm");
const addOrnamentDesignCancelBtn = document.getElementById("addOrnamentDesignCancelBtn");
const addOrnamentDesignStatus = document.getElementById("addOrnamentDesignStatus");
const newOrnamentDesignLabel = document.getElementById("newOrnamentDesignLabel");
const newOrnamentDesignPhoto = document.getElementById("newOrnamentDesignPhoto");
const feedbackListStatus = document.getElementById("feedbackListStatus");
const adminFeedbackList = document.getElementById("adminFeedbackList");
const feedbackItemTemplate = document.getElementById("feedbackItemTemplate");

const ASSET_LABELS = {
  logo: "Site Logo",
  heroImage: "Hero Photo (homepage top)",
  gallery1: "Showcase Photo 1",
  gallery2: "Showcase Photo 2",
  gallery3: "Showcase Photo 3",
  gallery4: "Showcase Photo 4"
};

let currentUserEmail = "";

function showOnly(el) {
  [
    setupNeededEl,
    loginSection,
    forgotPasswordSection,
    resetPasswordSection,
    dashboardSection
  ].forEach(function (section) {
    if (section) {
      section.hidden = section !== el;
    }
  });
}

function setDashboardStatus(message, isError) {
  if (!dashboardStatus) {
    return;
  }

  if (!message) {
    dashboardStatus.hidden = true;
    return;
  }

  dashboardStatus.textContent = message;
  dashboardStatus.hidden = false;
  dashboardStatus.classList.toggle("is-error", Boolean(isError));
}

async function requireClient() {
  const client = getSupabaseClient();

  if (!client) {
    showOnly(setupNeededEl);
    return null;
  }

  return client;
}

let isPasswordRecovery = false;
let authListenerRegistered = false;

function registerAuthListener(client) {
  if (authListenerRegistered) {
    return;
  }

  authListenerRegistered = true;

  // Fires automatically when the admin opens the "reset your password" link
  // from their email -- Supabase detects the recovery token in the URL and
  // starts a temporary recovery session, which we use to show the
  // "Set a new password" form instead of the normal login/dashboard.
  client.auth.onAuthStateChange(function (event) {
    if (event === "PASSWORD_RECOVERY") {
      isPasswordRecovery = true;
      showOnly(resetPasswordSection);
      if (logoutBtn) logoutBtn.hidden = true;
      if (settingsBtn) settingsBtn.hidden = true;
    }
  });
}

async function checkSession() {
  const client = await requireClient();

  if (!client) {
    return;
  }

  registerAuthListener(client);

  const { data } = await client.auth.getSession();

  if (isPasswordRecovery) {
    return;
  }

  if (data && data.session) {
    enterDashboard(client);
  } else {
    showOnly(loginSection);
    if (logoutBtn) logoutBtn.hidden = true;
    if (settingsBtn) settingsBtn.hidden = true;
  }
}

async function enterDashboard(client) {
  showOnly(dashboardSection);
  if (logoutBtn) logoutBtn.hidden = false;
  if (settingsBtn) settingsBtn.hidden = false;

  const { data } = await client.auth.getUser();
  currentUserEmail = data && data.user ? data.user.email : "";

  await loadProducts(client);
  connectAddProductForm(client);
  await loadFeedback(client);
  await loadSiteAssets(client);
  await loadOrnamentDesigns(client);
  connectAddOrnamentDesignForm(client);
}

function setSettingsMessage(el, message, isError) {
  if (!el) return;

  if (!message) {
    el.hidden = true;
    return;
  }

  el.textContent = message;
  el.hidden = false;
  el.classList.toggle("is-error", Boolean(isError));
  el.classList.remove("is-success");
}

function openSettings() {
  if (settingsOverlay) settingsOverlay.classList.add("is-open");
}

function closeSettings() {
  if (settingsOverlay) settingsOverlay.classList.remove("is-open");
  setSettingsMessage(passwordMsg, "", false);
  setSettingsMessage(emailMsg, "", false);
  if (changePasswordForm) changePasswordForm.reset();
  if (changeEmailForm) changeEmailForm.reset();
}

async function loadProducts(client) {
  setDashboardStatus("Loading products...", false);
  adminProductGrid.innerHTML = "";

  const { data, error } = await client
    .from(SUPABASE_PRODUCTS_TABLE)
    .select("key, name, price, image_url, description, size_type, sizes")
    .order("sort_order", { ascending: true });

  if (error) {
    setDashboardStatus(
      "Could not load products: " + error.message,
      true
    );
    return;
  }

  if (!data || !data.length) {
    setDashboardStatus(
      "No products found yet. Run supabase-admin-setup.sql to seed the products table.",
      true
    );
    return;
  }

  setDashboardStatus("", false);

  data.forEach(function (row) {
    renderProductCard(client, row);
  });
}

/* ========================================================================
 * SHARED "PICK A NEW PHOTO" PREVIEW/CANCEL UI
 * ------------------------------------------------------------------------
 * Used by every admin image-replace control (products, branding/gallery,
 * ornament designs). Picking a file shows an instant local preview + a
 * "Preview - not saved yet" badge + a Cancel button, so the owner can see
 * exactly what they're about to publish before committing, and can back
 * out to the current live photo with one click instead of ever being left
 * looking at a blank/broken "no design" image.
 * ====================================================================== */
function setupImagePreview(fileInput, imgEl, pendingBadge, cancelBtn, statusEl, nameDisplayEl) {
  let savedSrc = imgEl.src;
  let objectUrl = null;

  fileInput.addEventListener("change", function () {
    const file = fileInput.files && fileInput.files[0];

    if (!file) {
      return;
    }

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }

    objectUrl = URL.createObjectURL(file);
    imgEl.src = objectUrl;
    pendingBadge.hidden = false;
    cancelBtn.hidden = false;
    statusEl.textContent = "";
    statusEl.className = "admin-card-status";

    if (nameDisplayEl) {
      nameDisplayEl.textContent = file.name;
    }
  });

  cancelBtn.addEventListener("click", function () {
    fileInput.value = "";

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }

    imgEl.src = savedSrc;
    pendingBadge.hidden = true;
    cancelBtn.hidden = true;
    statusEl.textContent = "";
    statusEl.className = "admin-card-status";

    if (nameDisplayEl) {
      nameDisplayEl.textContent = "No file selected";
    }
  });

  return {
    markSaved: function (newSrc) {
      savedSrc = newSrc || imgEl.src;
      pendingBadge.hidden = true;
      cancelBtn.hidden = true;
    }
  };
}

// Lightweight filename readout for one-off file inputs that don't use the
// full preview/cancel UI above (e.g. the "Add New Product" form).
function wireFileNameDisplay(fileInput, nameDisplayEl, fallbackText) {
  if (!fileInput || !nameDisplayEl) {
    return;
  }

  fileInput.addEventListener("change", function () {
    const file = fileInput.files && fileInput.files[0];
    nameDisplayEl.textContent = file ? file.name : (fallbackText || "No file selected");
  });
}

// Turns a product name into a URL/DB-safe, guaranteed-unique key, e.g.
// "Custom Dog Mug!" -> "custom-dog-mug-m4f2k1". The random suffix means two
// products can share the same name without a primary-key collision.
function slugifyProductKey(name) {
  const base = String(name || "product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "") || "product";

  return base + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Fixed size option sets, kept identical to SIZE_OPTIONS_BY_TYPE in
// script.js so the storefront's Customize modal and this admin UI always
// agree on what "drinkware"/"apparel" sizes mean.
const SIZE_OPTIONS_BY_TYPE = {
  drinkware: ["12oz", "16oz", "22oz"],
  apparel: ["Small", "Medium", "Large", "XL"]
};

// Fills a product card's ".admin-size-checkboxes" container with one
// checkbox per fixed size for the given sizeType, checked according to
// existingSizes (defaults every size to "available" the first time a type
// is picked, e.g. when adding a new product or switching types).
function renderSizeCheckboxes(container, sizeType, existingSizes) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  const labels = SIZE_OPTIONS_BY_TYPE[sizeType];

  if (!labels) {
    container.hidden = true;
    return;
  }

  const existingByLabel = {};
  (existingSizes || []).forEach(function (size) {
    if (size && size.label) {
      existingByLabel[size.label] = size.available !== false;
    }
  });

  const headingEl = document.createElement("span");
  headingEl.className = "admin-size-checkboxes-label";
  headingEl.textContent = "Available sizes (untick to mark as not available)";
  container.appendChild(headingEl);

  labels.forEach(function (label) {
    const isAvailable = Object.prototype.hasOwnProperty.call(existingByLabel, label)
      ? existingByLabel[label]
      : true;

    const wrapper = document.createElement("label");
    wrapper.className = "admin-size-checkbox" + (isAvailable ? "" : " is-unavailable");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isAvailable;
    checkbox.dataset.sizeLabel = label;
    checkbox.addEventListener("change", function () {
      wrapper.classList.toggle("is-unavailable", !checkbox.checked);
    });

    wrapper.appendChild(checkbox);
    wrapper.appendChild(document.createTextNode(label));
    container.appendChild(wrapper);
  });

  container.hidden = false;
}

// Reads whatever renderSizeCheckboxes() built back out into the JSON shape
// the "sizes" column expects: [{label, available}, ...].
function readSizesFromCheckboxes(container) {
  if (!container) {
    return [];
  }

  return Array.prototype.map.call(
    container.querySelectorAll("input[type=checkbox]"),
    function (checkbox) {
      return { label: checkbox.dataset.sizeLabel, available: checkbox.checked };
    }
  );
}

// Wires a "Size options" <select> (none/drinkware/apparel) to its
// checkboxes container so picking a type immediately shows the matching
// size checkboxes (or hides them for "none").
function connectSizeTypeSelect(selectEl, checkboxContainer, initialSizeType, initialSizes) {
  if (!selectEl) {
    return;
  }

  selectEl.value = initialSizeType || "none";

  if (selectEl.value === "none") {
    checkboxContainer.hidden = true;
    checkboxContainer.innerHTML = "";
  } else {
    renderSizeCheckboxes(checkboxContainer, selectEl.value, initialSizes);
  }

  selectEl.addEventListener("change", function () {
    if (selectEl.value === "none") {
      checkboxContainer.hidden = true;
      checkboxContainer.innerHTML = "";
    } else {
      // Switching type starts every size fresh/available rather than
      // carrying over availability from a different size set.
      renderSizeCheckboxes(checkboxContainer, selectEl.value, []);
    }
  });
}

function renderProductCard(client, row) {
  const node = adminProductTemplate.content.cloneNode(true);
  const cardEl = node.querySelector(".admin-product-card");
  const img = node.querySelector(".admin-product-image img");
  const pendingBadge = node.querySelector(".admin-pending-badge");
  const nameInput = node.querySelector(".admin-name-input");
  const priceInput = node.querySelector(".admin-price-input");
  const descInput = node.querySelector(".admin-desc-input");
  const sizeTypeSelect = node.querySelector(".admin-size-type-select");
  const sizeCheckboxes = node.querySelector(".admin-size-checkboxes");
  const fileInput = node.querySelector(".admin-file-input");
  const fileNameEl = node.querySelector(".admin-file-upload-name");
  const saveBtn = node.querySelector(".admin-save-btn");
  const cancelBtn = node.querySelector(".admin-cancel-btn");
  const deleteBtn = node.querySelector(".admin-delete-btn");
  const statusEl = node.querySelector(".admin-card-status");

  img.src = row.image_url || "";
  img.alt = row.name || row.key;
  nameInput.value = row.name || "";
  priceInput.value =
    row.price !== null && row.price !== undefined ? row.price : "";
  descInput.value = row.description || "";
  connectSizeTypeSelect(sizeTypeSelect, sizeCheckboxes, row.size_type, row.sizes);

  const preview = setupImagePreview(fileInput, img, pendingBadge, cancelBtn, statusEl, fileNameEl);

  saveBtn.addEventListener("click", function () {
    saveProduct(client, row.key, nameInput, priceInput, descInput, sizeTypeSelect, sizeCheckboxes, fileInput, saveBtn, statusEl, img, preview);
  });

  deleteBtn.addEventListener("click", function () {
    deleteProduct(client, row.key, row.name, cardEl, deleteBtn, statusEl);
  });

  adminProductGrid.appendChild(node);
}

async function saveProduct(client, key, nameInput, priceInput, descInput, sizeTypeSelect, sizeCheckboxes, fileInput, saveBtn, statusEl, imgEl, preview) {
  const newName = nameInput.value.trim();
  const newPrice = parseFloat(priceInput.value);

  if (!newName) {
    statusEl.textContent = "Enter a product name.";
    statusEl.className = "admin-card-status is-error";
    return;
  }

  if (Number.isNaN(newPrice) || newPrice < 0) {
    statusEl.textContent = "Enter a valid price.";
    statusEl.className = "admin-card-status is-error";
    return;
  }

  saveBtn.disabled = true;
  statusEl.textContent = "Saving...";
  statusEl.className = "admin-card-status";

  try {
    const sizeType = sizeTypeSelect ? sizeTypeSelect.value : "none";
    const updatePayload = {
      name: newName,
      price: newPrice,
      description: descInput.value.trim(),
      size_type: sizeType,
      sizes: sizeType === "none" ? [] : readSizesFromCheckboxes(sizeCheckboxes),
      updated_at: new Date().toISOString()
    };

    const file = fileInput.files && fileInput.files[0];

    if (file) {
      const ext = file.name.split(".").pop();
      const path = key + "-" + Date.now() + "." + ext;

      const { error: uploadError } = await client.storage
        .from(SUPABASE_PRODUCTS_BUCKET)
        .upload(path, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = client.storage
        .from(SUPABASE_PRODUCTS_BUCKET)
        .getPublicUrl(path);

      if (publicUrlData && publicUrlData.publicUrl) {
        updatePayload.image_url = publicUrlData.publicUrl;
        imgEl.src = publicUrlData.publicUrl;
      }
    }

    const { error: updateError } = await client
      .from(SUPABASE_PRODUCTS_TABLE)
      .update(updatePayload)
      .eq("key", key);

    if (updateError) {
      throw updateError;
    }

    fileInput.value = "";
    preview.markSaved(imgEl.src);
    statusEl.textContent = "Saved!";
    statusEl.className = "admin-card-status is-success";
  } catch (err) {
    console.error("Save failed:", err);
    statusEl.textContent = "Save failed: " + (err.message || "unknown error");
    statusEl.className = "admin-card-status is-error";
  } finally {
    saveBtn.disabled = false;
  }
}

async function deleteProduct(client, key, name, cardEl, deleteBtn, statusEl) {
  const confirmed = window.confirm(
    "Remove \"" + (name || key) + "\" from the website? This can't be undone."
  );

  if (!confirmed) {
    return;
  }

  deleteBtn.disabled = true;
  statusEl.textContent = "Deleting...";
  statusEl.className = "admin-card-status";

  try {
    const { error } = await client
      .from(SUPABASE_PRODUCTS_TABLE)
      .delete()
      .eq("key", key);

    if (error) {
      throw error;
    }

    if (cardEl && cardEl.parentNode) {
      cardEl.parentNode.removeChild(cardEl);
    }

    if (adminProductGrid && !adminProductGrid.querySelector(".admin-product-card")) {
      setDashboardStatus(
        "No products yet. Use \"+ Add New Product\" above to add one.",
        false
      );
    }
  } catch (err) {
    console.error("Delete failed:", err);
    statusEl.textContent = "Delete failed: " + (err.message || "unknown error");
    statusEl.className = "admin-card-status is-error";
    deleteBtn.disabled = false;
  }
}

let addProductFormConnected = false;

function connectAddProductForm(client) {
  if (!addProductForm || !addProductToggleBtn) {
    return;
  }

  // enterDashboard() (and therefore this function) can run more than once
  // per page load if the owner logs out and back in -- guard against
  // re-binding the same listeners twice (the Supabase client itself is a
  // cached singleton, so the one captured below stays valid either way).
  if (addProductFormConnected) {
    return;
  }
  addProductFormConnected = true;

  const photoNameEl = addProductForm.querySelector(".admin-file-upload-name");
  wireFileNameDisplay(newProductPhoto, photoNameEl, "No file selected");
  connectSizeTypeSelect(newProductSizeType, newProductSizeChecks, "none", []);

  function resetAddProductForm() {
    addProductForm.reset();
    if (photoNameEl) {
      photoNameEl.textContent = "No file selected";
    }
    if (newProductSizeChecks) {
      newProductSizeChecks.hidden = true;
      newProductSizeChecks.innerHTML = "";
    }
    setSettingsMessage(addProductStatus, "", false);
  }

  addProductToggleBtn.addEventListener("click", function () {
    const isHidden = addProductForm.hidden;
    addProductForm.hidden = !isHidden;

    if (!isHidden) {
      resetAddProductForm();
    } else if (newProductName) {
      newProductName.focus();
    }
  });

  if (addProductCancelBtn) {
    addProductCancelBtn.addEventListener("click", function () {
      addProductForm.hidden = true;
      resetAddProductForm();
    });
  }

  addProductForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const name = newProductName.value.trim();
    const price = parseFloat(newProductPrice.value);
    const description = newProductDescription.value.trim();
    const file = newProductPhoto.files && newProductPhoto.files[0];
    const submitBtn = addProductForm.querySelector('button[type="submit"]');

    if (!name) {
      setSettingsMessage(addProductStatus, "Enter a product name.", true);
      return;
    }

    if (Number.isNaN(price) || price < 0) {
      setSettingsMessage(addProductStatus, "Enter a valid price.", true);
      return;
    }

    if (!file) {
      setSettingsMessage(addProductStatus, "Choose a product photo.", true);
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    setSettingsMessage(addProductStatus, "Adding product...", false);

    try {
      const key = slugifyProductKey(name);
      const ext = file.name.split(".").pop();
      const path = key + "-" + Date.now() + "." + ext;

      const { error: uploadError } = await client.storage
        .from(SUPABASE_PRODUCTS_BUCKET)
        .upload(path, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = client.storage
        .from(SUPABASE_PRODUCTS_BUCKET)
        .getPublicUrl(path);

      const imageUrl = publicUrlData && publicUrlData.publicUrl ? publicUrlData.publicUrl : "";

      const sizeType = newProductSizeType ? newProductSizeType.value : "none";

      const newRow = {
        key: key,
        name: name,
        price: price,
        image_url: imageUrl,
        description: description,
        size_type: sizeType,
        sizes: sizeType === "none" ? [] : readSizesFromCheckboxes(newProductSizeChecks),
        sort_order: Date.now()
      };

      const { error: insertError } = await client
        .from(SUPABASE_PRODUCTS_TABLE)
        .insert(newRow);

      if (insertError) {
        throw insertError;
      }

      renderProductCard(client, newRow);
      setDashboardStatus("", false);

      addProductForm.hidden = true;
      resetAddProductForm();
    } catch (err) {
      console.error("Add product failed:", err);
      setSettingsMessage(
        addProductStatus,
        "Could not add product: " + (err.message || "unknown error"),
        true
      );
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function setStatusEl(el, message, isError) {
  if (!el) {
    return;
  }

  if (!message) {
    el.hidden = true;
    return;
  }

  el.textContent = message;
  el.hidden = false;
  el.classList.toggle("is-error", Boolean(isError));
}

function setAssetsStatus(message, isError) {
  setStatusEl(assetsStatus, message, isError);
}

function setOrnamentDesignsStatus(message, isError) {
  setStatusEl(ornamentDesignsStatus, message, isError);
}

function setFeedbackListStatus(message, isError) {
  setStatusEl(feedbackListStatus, message, isError);
}

async function loadFeedback(client) {
  if (!adminFeedbackList) {
    return;
  }

  setFeedbackListStatus("Loading feedback...", false);
  adminFeedbackList.innerHTML = "";

  const { data, error } = await client
    .from(SUPABASE_FEEDBACK_TABLE)
    .select("id, name, email, rating, message, is_read, is_published, admin_reply, replied_at, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    setFeedbackListStatus("Could not load feedback: " + error.message, true);
    return;
  }

  if (!data || !data.length) {
    setFeedbackListStatus("No feedback submitted yet.", false);
    return;
  }

  setFeedbackListStatus("", false);

  data.forEach(function (row) {
    renderFeedbackItem(client, row);
  });
}

function renderFeedbackItem(client, row) {
  if (!adminFeedbackList || !feedbackItemTemplate) {
    return;
  }

  const node = feedbackItemTemplate.content.cloneNode(true);
  const articleEl = node.querySelector(".admin-feedback-item");
  const nameEl = node.querySelector(".admin-feedback-name");
  const emailEl = node.querySelector(".admin-feedback-email");
  const starsEl = node.querySelector(".admin-feedback-stars");
  const messageEl = node.querySelector(".admin-feedback-message");
  const dateEl = node.querySelector(".admin-feedback-date");
  const readBtn = node.querySelector(".admin-feedback-read-btn");
  const deleteBtn = node.querySelector(".admin-feedback-delete-btn");
  const publishCheckbox = node.querySelector(".admin-feedback-publish-input");
  const publishLabel = node.querySelector(".admin-feedback-publish");
  const prevReplyEl = node.querySelector(".admin-feedback-prev-reply");
  const replyInput = node.querySelector(".admin-feedback-reply-input");
  const replyBtn = node.querySelector(".admin-feedback-reply-btn");
  const replyStatusEl = node.querySelector(".admin-feedback-reply-status");
  const noEmailNote = node.querySelector(".admin-feedback-no-email-note");

  nameEl.textContent = row.name || "Anonymous";
  emailEl.textContent = row.email || "";
  emailEl.hidden = !row.email;

  if (row.rating) {
    starsEl.textContent = "★".repeat(row.rating) + "☆".repeat(5 - row.rating);
  } else {
    starsEl.textContent = "No rating";
  }

  messageEl.textContent = row.message;

  const createdAt = row.created_at ? new Date(row.created_at) : null;
  dateEl.textContent = createdAt ? createdAt.toLocaleString() : "";

  function applyReadState(isRead) {
    articleEl.classList.toggle("is-unread", !isRead);
    readBtn.textContent = isRead ? "Mark as unread" : "Mark as read";
  }

  applyReadState(Boolean(row.is_read));

  readBtn.addEventListener("click", async function () {
    const nextState = !row.is_read;
    readBtn.disabled = true;

    const { error } = await client
      .from(SUPABASE_FEEDBACK_TABLE)
      .update({ is_read: nextState })
      .eq("id", row.id);

    readBtn.disabled = false;

    if (error) {
      setFeedbackListStatus("Could not update feedback: " + error.message, true);
      return;
    }

    row.is_read = nextState;
    applyReadState(nextState);
  });

  if (publishCheckbox) {
    publishCheckbox.checked = Boolean(row.is_published);

    publishCheckbox.addEventListener("change", async function () {
      const nextState = publishCheckbox.checked;
      publishCheckbox.disabled = true;

      const { error } = await client
        .from(SUPABASE_FEEDBACK_TABLE)
        .update({ is_published: nextState })
        .eq("id", row.id);

      publishCheckbox.disabled = false;

      if (error) {
        publishCheckbox.checked = !nextState;
        setFeedbackListStatus("Could not update feedback: " + error.message, true);
        return;
      }

      row.is_published = nextState;

      if (publishLabel) {
        publishLabel.classList.toggle("is-published", nextState);
      }
    });

    if (publishLabel) {
      publishLabel.classList.toggle("is-published", Boolean(row.is_published));
    }
  }

  deleteBtn.addEventListener("click", async function () {
    if (!window.confirm("Delete this feedback entry? This cannot be undone.")) {
      return;
    }

    deleteBtn.disabled = true;

    const { error } = await client
      .from(SUPABASE_FEEDBACK_TABLE)
      .delete()
      .eq("id", row.id);

    if (error) {
      deleteBtn.disabled = false;
      setFeedbackListStatus("Could not delete feedback: " + error.message, true);
      return;
    }

    articleEl.remove();

    if (!adminFeedbackList.children.length) {
      setFeedbackListStatus("No feedback submitted yet.", false);
    }
  });

  function showPrevReply() {
    if (!prevReplyEl) {
      return;
    }

    if (!row.admin_reply) {
      prevReplyEl.hidden = true;
      return;
    }

    const repliedAt = row.replied_at ? new Date(row.replied_at).toLocaleString() : "";
    prevReplyEl.hidden = false;
    prevReplyEl.innerHTML = "";

    const label = document.createElement("strong");
    label.textContent = "Your reply" + (repliedAt ? " - " + repliedAt : "");
    prevReplyEl.appendChild(label);
    prevReplyEl.appendChild(document.createTextNode(row.admin_reply));
  }

  showPrevReply();

  if (replyInput) {
    replyInput.value = row.admin_reply || "";
  }

  function setReplyStatus(message, isError) {
    if (!replyStatusEl) {
      return;
    }

    replyStatusEl.textContent = message || "";
    replyStatusEl.className =
      "admin-card-status admin-feedback-reply-status" +
      (message ? (isError ? " is-error" : " is-success") : "");
  }

  const canReply = Boolean(row.email);

  if (noEmailNote) {
    noEmailNote.hidden = canReply;
  }

  if (!canReply) {
    if (replyInput) replyInput.disabled = true;
    if (replyBtn) replyBtn.disabled = true;
  } else if (replyBtn) {
    replyBtn.addEventListener("click", async function () {
      const replyText = replyInput ? replyInput.value.trim() : "";

      if (!replyText) {
        setReplyStatus("Write a reply first.", true);
        return;
      }

      if (!isFeedbackReplyConfigured()) {
        setReplyStatus(
          "Reply emails aren't set up yet -- add EMAILJS_FEEDBACK_REPLY_TEMPLATE_ID in supabase-config.js (see email-templates/feedback-reply.html).",
          true
        );
        return;
      }

      if (!window.emailjs) {
        setReplyStatus("Email service failed to load. Check your connection and try again.", true);
        return;
      }

      replyBtn.disabled = true;
      setReplyStatus("Sending reply...", false);

      try {
        await window.emailjs.send(
          EMAILJS_ACCOUNT_3_SERVICE_ID,
          EMAILJS_FEEDBACK_REPLY_TEMPLATE_ID,
          {
            customer_name: row.name || "there",
            customer_email: row.email,
            original_message: row.message,
            reply_message: replyText
          },
          { publicKey: EMAILJS_ACCOUNT_3_PUBLIC_KEY }
        );

        const repliedAtIso = new Date().toISOString();

        const { error } = await client
          .from(SUPABASE_FEEDBACK_TABLE)
          .update({ admin_reply: replyText, replied_at: repliedAtIso })
          .eq("id", row.id);

        if (error) {
          throw error;
        }

        row.admin_reply = replyText;
        row.replied_at = repliedAtIso;
        showPrevReply();
        setReplyStatus("Reply sent!", false);
      } catch (err) {
        console.error("Send reply failed:", err);
        setReplyStatus(
          "Could not send reply: " + (err.message || err.text || "unknown error"),
          true
        );
      } finally {
        replyBtn.disabled = false;
      }
    });
  }

  adminFeedbackList.appendChild(node);
}

// Applies a freshly saved/loaded asset URL to EVERY matching element on the
// current page -- e.g. the admin header's own logo (data-asset-key="logo"),
// not just the one grid card the admin is editing. This is what keeps the
// admin portal's own branding in sync with whatever is saved, the same way
// the storefront (index.html) already does via loadLiveSiteAssets().
function applyAssetToPageElements(key, imageUrl) {
  if (!key || !imageUrl) {
    return;
  }

  document
    .querySelectorAll('[data-asset-key="' + key + '"]')
    .forEach(function (el) {
      el.src = imageUrl;
    });
}

async function loadSiteAssets(client) {
  if (!adminAssetGrid) {
    return;
  }

  setAssetsStatus("Loading branding, gallery & ornament design photos...", false);
  adminAssetGrid.innerHTML = "";

  const { data, error } = await client
    .from(SUPABASE_SITE_ASSETS_TABLE)
    .select("key, image_url")
    .order("sort_order", { ascending: true });

  if (error) {
    setAssetsStatus(
      "Could not load branding/gallery/ornament photos: " + error.message,
      true
    );
    return;
  }

  if (!data || !data.length) {
    setAssetsStatus(
      "No assets found yet. Run supabase-admin-setup.sql to seed them.",
      true
    );
    return;
  }

  setAssetsStatus("", false);

  data.forEach(function (row) {
    applyAssetToPageElements(row.key, row.image_url);
  });

  data.forEach(function (row) {
    renderAssetCard(client, row, adminAssetGrid);
  });
}

function renderAssetCard(client, row, targetGrid) {
  if (!targetGrid) {
    return;
  }

  const node = adminAssetTemplate.content.cloneNode(true);
  const img = node.querySelector(".admin-product-image img");
  const pendingBadge = node.querySelector(".admin-pending-badge");
  const nameEl = node.querySelector(".admin-product-name");
  const fileInput = node.querySelector(".admin-file-input");
  const fileNameEl = node.querySelector(".admin-file-upload-name");
  const saveBtn = node.querySelector(".admin-save-btn");
  const cancelBtn = node.querySelector(".admin-cancel-btn");
  const statusEl = node.querySelector(".admin-card-status");

  const label = ASSET_LABELS[row.key] || row.key;

  img.src = row.image_url || "";
  img.alt = label;
  nameEl.textContent = label;

  const preview = setupImagePreview(fileInput, img, pendingBadge, cancelBtn, statusEl, fileNameEl);

  saveBtn.addEventListener("click", function () {
    saveAsset(client, row.key, fileInput, saveBtn, statusEl, img, preview);
  });

  targetGrid.appendChild(node);
}

async function saveAsset(client, key, fileInput, saveBtn, statusEl, imgEl, preview) {
  const file = fileInput.files && fileInput.files[0];

  if (!file) {
    statusEl.textContent = "Choose a photo first.";
    statusEl.className = "admin-card-status is-error";
    return;
  }

  saveBtn.disabled = true;
  statusEl.textContent = "Saving...";
  statusEl.className = "admin-card-status";

  try {
    const ext = file.name.split(".").pop();
    const path = key + "-" + Date.now() + "." + ext;

    const { error: uploadError } = await client.storage
      .from(SUPABASE_SITE_ASSETS_BUCKET)
      .upload(path, file, { upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = client.storage
      .from(SUPABASE_SITE_ASSETS_BUCKET)
      .getPublicUrl(path);

    const updatePayload = { updated_at: new Date().toISOString() };

    if (publicUrlData && publicUrlData.publicUrl) {
      updatePayload.image_url = publicUrlData.publicUrl;
      imgEl.src = publicUrlData.publicUrl;
    }

    const { error: updateError } = await client
      .from(SUPABASE_SITE_ASSETS_TABLE)
      .update(updatePayload)
      .eq("key", key);

    if (updateError) {
      throw updateError;
    }

    // Also push the new URL to any OTHER matching element on this page
    // (e.g. the admin header's own logo), so it updates immediately without
    // needing a refresh -- the live website picks it up the same way on its
    // own next page load via loadLiveSiteAssets().
    if (updatePayload.image_url) {
      applyAssetToPageElements(key, updatePayload.image_url);
    }

    fileInput.value = "";
    preview.markSaved(imgEl.src);
    statusEl.textContent = "Saved!";
    statusEl.className = "admin-card-status is-success";
  } catch (err) {
    console.error("Save failed:", err);
    statusEl.textContent = "Save failed: " + (err.message || "unknown error");
    statusEl.className = "admin-card-status is-error";
  } finally {
    saveBtn.disabled = false;
  }
}

/* ========================================================================
 * CERAMIC ORNAMENT DESIGNS (owner can add/rename/replace-photo/remove)
 * ------------------------------------------------------------------------
 * Unlike the fixed logo/hero/gallery rows above (always exactly those 6
 * keys), these live in their own ornament_designs table with a normal
 * auto-increment id, so the owner can add as many designs as they want or
 * remove ones they no longer offer -- mirrors the product add/remove UI.
 * Design photos are stored in the same "site-assets" Storage bucket used
 * for branding/gallery photos (no separate bucket needed).
 * ====================================================================== */
async function loadOrnamentDesigns(client) {
  if (!adminOrnamentDesignGrid) {
    return;
  }

  setOrnamentDesignsStatus("Loading ornament designs...", false);
  adminOrnamentDesignGrid.innerHTML = "";

  const { data, error } = await client
    .from(SUPABASE_ORNAMENT_DESIGNS_TABLE)
    .select("id, label, image_url, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    setOrnamentDesignsStatus(
      "Could not load ornament designs: " + error.message,
      true
    );
    return;
  }

  if (!data || !data.length) {
    setOrnamentDesignsStatus(
      "No ornament designs yet. Use \"+ Add New Design\" above to add one.",
      false
    );
    return;
  }

  setOrnamentDesignsStatus("", false);

  data.forEach(function (row) {
    renderOrnamentDesignCard(client, row);
  });
}

function renderOrnamentDesignCard(client, row) {
  if (!adminOrnamentDesignGrid || !adminOrnamentDesignTemplate) {
    return;
  }

  const node = adminOrnamentDesignTemplate.content.cloneNode(true);
  const cardEl = node.querySelector(".admin-product-card");
  const img = node.querySelector(".admin-product-image img");
  const pendingBadge = node.querySelector(".admin-pending-badge");
  const nameInput = node.querySelector(".admin-name-input");
  const fileInput = node.querySelector(".admin-file-input");
  const fileNameEl = node.querySelector(".admin-file-upload-name");
  const saveBtn = node.querySelector(".admin-save-btn");
  const cancelBtn = node.querySelector(".admin-cancel-btn");
  const deleteBtn = node.querySelector(".admin-delete-btn");
  const statusEl = node.querySelector(".admin-card-status");

  img.src = row.image_url || "";
  img.alt = row.label || "Ornament design";
  nameInput.value = row.label || "";

  const preview = setupImagePreview(fileInput, img, pendingBadge, cancelBtn, statusEl, fileNameEl);

  saveBtn.addEventListener("click", function () {
    saveOrnamentDesign(client, row.id, nameInput, fileInput, saveBtn, statusEl, img, preview);
  });

  deleteBtn.addEventListener("click", function () {
    deleteOrnamentDesign(client, row.id, row.label, cardEl, deleteBtn, statusEl);
  });

  adminOrnamentDesignGrid.appendChild(node);
}

async function saveOrnamentDesign(client, id, nameInput, fileInput, saveBtn, statusEl, imgEl, preview) {
  const newLabel = nameInput.value.trim();

  if (!newLabel) {
    statusEl.textContent = "Enter a design name.";
    statusEl.className = "admin-card-status is-error";
    return;
  }

  saveBtn.disabled = true;
  statusEl.textContent = "Saving...";
  statusEl.className = "admin-card-status";

  try {
    const updatePayload = { label: newLabel };
    const file = fileInput.files && fileInput.files[0];

    if (file) {
      const ext = file.name.split(".").pop();
      const path = "ornament-design-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) + "." + ext;

      const { error: uploadError } = await client.storage
        .from(SUPABASE_SITE_ASSETS_BUCKET)
        .upload(path, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = client.storage
        .from(SUPABASE_SITE_ASSETS_BUCKET)
        .getPublicUrl(path);

      if (publicUrlData && publicUrlData.publicUrl) {
        updatePayload.image_url = publicUrlData.publicUrl;
        imgEl.src = publicUrlData.publicUrl;
      }
    }

    const { error: updateError } = await client
      .from(SUPABASE_ORNAMENT_DESIGNS_TABLE)
      .update(updatePayload)
      .eq("id", id);

    if (updateError) {
      throw updateError;
    }

    fileInput.value = "";
    preview.markSaved(imgEl.src);
    statusEl.textContent = "Saved!";
    statusEl.className = "admin-card-status is-success";
  } catch (err) {
    console.error("Save failed:", err);
    statusEl.textContent = "Save failed: " + (err.message || "unknown error");
    statusEl.className = "admin-card-status is-error";
  } finally {
    saveBtn.disabled = false;
  }
}

async function deleteOrnamentDesign(client, id, label, cardEl, deleteBtn, statusEl) {
  const confirmed = window.confirm(
    "Remove the \"" + (label || "design") + "\" ornament design? This can't be undone."
  );

  if (!confirmed) {
    return;
  }

  deleteBtn.disabled = true;
  statusEl.textContent = "Deleting...";
  statusEl.className = "admin-card-status";

  try {
    const { error } = await client
      .from(SUPABASE_ORNAMENT_DESIGNS_TABLE)
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }

    if (cardEl && cardEl.parentNode) {
      cardEl.parentNode.removeChild(cardEl);
    }

    if (adminOrnamentDesignGrid && !adminOrnamentDesignGrid.querySelector(".admin-product-card")) {
      setOrnamentDesignsStatus(
        "No ornament designs yet. Use \"+ Add New Design\" above to add one.",
        false
      );
    }
  } catch (err) {
    console.error("Delete failed:", err);
    statusEl.textContent = "Delete failed: " + (err.message || "unknown error");
    statusEl.className = "admin-card-status is-error";
    deleteBtn.disabled = false;
  }
}

let addOrnamentDesignFormConnected = false;

function connectAddOrnamentDesignForm(client) {
  if (!addOrnamentDesignForm || !addOrnamentDesignToggleBtn) {
    return;
  }

  if (addOrnamentDesignFormConnected) {
    return;
  }
  addOrnamentDesignFormConnected = true;

  const photoNameEl = addOrnamentDesignForm.querySelector(".admin-file-upload-name");
  wireFileNameDisplay(newOrnamentDesignPhoto, photoNameEl, "No file selected");

  function resetAddOrnamentDesignForm() {
    addOrnamentDesignForm.reset();
    if (photoNameEl) {
      photoNameEl.textContent = "No file selected";
    }
    setSettingsMessage(addOrnamentDesignStatus, "", false);
  }

  addOrnamentDesignToggleBtn.addEventListener("click", function () {
    const isHidden = addOrnamentDesignForm.hidden;
    addOrnamentDesignForm.hidden = !isHidden;

    if (!isHidden) {
      resetAddOrnamentDesignForm();
    } else if (newOrnamentDesignLabel) {
      newOrnamentDesignLabel.focus();
    }
  });

  if (addOrnamentDesignCancelBtn) {
    addOrnamentDesignCancelBtn.addEventListener("click", function () {
      addOrnamentDesignForm.hidden = true;
      resetAddOrnamentDesignForm();
    });
  }

  addOrnamentDesignForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const label = newOrnamentDesignLabel.value.trim();
    const file = newOrnamentDesignPhoto.files && newOrnamentDesignPhoto.files[0];
    const submitBtn = addOrnamentDesignForm.querySelector('button[type="submit"]');

    if (!label) {
      setSettingsMessage(addOrnamentDesignStatus, "Enter a design name.", true);
      return;
    }

    if (!file) {
      setSettingsMessage(addOrnamentDesignStatus, "Choose a design photo.", true);
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    setSettingsMessage(addOrnamentDesignStatus, "Adding design...", false);

    try {
      const ext = file.name.split(".").pop();
      const path = "ornament-design-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) + "." + ext;

      const { error: uploadError } = await client.storage
        .from(SUPABASE_SITE_ASSETS_BUCKET)
        .upload(path, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = client.storage
        .from(SUPABASE_SITE_ASSETS_BUCKET)
        .getPublicUrl(path);

      const imageUrl = publicUrlData && publicUrlData.publicUrl ? publicUrlData.publicUrl : "";

      const newRow = {
        label: label,
        image_url: imageUrl,
        sort_order: Date.now()
      };

      const { data: insertData, error: insertError } = await client
        .from(SUPABASE_ORNAMENT_DESIGNS_TABLE)
        .insert(newRow)
        .select("id, label, image_url, sort_order")
        .single();

      if (insertError) {
        throw insertError;
      }

      renderOrnamentDesignCard(client, insertData || newRow);
      setOrnamentDesignsStatus("", false);

      addOrnamentDesignForm.hidden = true;
      resetAddOrnamentDesignForm();
    } catch (err) {
      console.error("Add ornament design failed:", err);
      setSettingsMessage(
        addOrnamentDesignStatus,
        "Could not add design: " + (err.message || "unknown error"),
        true
      );
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  checkSession();

  if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const client = await requireClient();
      if (!client) return;

      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      loginError.hidden = true;
      loginSubmit.disabled = true;
      loginSubmit.textContent = "Logging in...";

      const { error } = await client.auth.signInWithPassword({
        email: email,
        password: password
      });

      loginSubmit.disabled = false;
      loginSubmit.textContent = "Log In";

      if (error) {
        loginError.textContent = error.message;
        loginError.hidden = false;
        return;
      }

      enterDashboard(client);
    });
  }

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", function () {
      setSettingsMessage(forgotPasswordStatus, "", false);
      if (forgotPasswordForm) forgotPasswordForm.reset();
      showOnly(forgotPasswordSection);
    });
  }

  if (backToLoginLink) {
    backToLoginLink.addEventListener("click", function () {
      showOnly(loginSection);
    });
  }

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const client = await requireClient();
      if (!client) return;

      const email = document.getElementById("forgotPasswordEmail").value.trim();

      setSettingsMessage(forgotPasswordStatus, "", false);
      forgotPasswordSubmit.disabled = true;
      forgotPasswordSubmit.textContent = "Sending...";

      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      });

      forgotPasswordSubmit.disabled = false;
      forgotPasswordSubmit.textContent = "Send Reset Link";

      if (error) {
        setSettingsMessage(forgotPasswordStatus, error.message, true);
        return;
      }

      setSettingsMessage(
        forgotPasswordStatus,
        "Check your email for a reset link. It may take a minute to arrive.",
        false
      );
      forgotPasswordStatus.classList.add("is-success");

      // FYI-only notification -- the actual secure reset link always comes
      // from Supabase itself, this is just a heads-up copy to the owner.
      if (isResetNotifyConfigured() && window.emailjs) {
        window.emailjs
          .send(
            EMAILJS_ACCOUNT_2_SERVICE_ID,
            EMAILJS_RESET_NOTIFY_TEMPLATE_ID,
            {
              account_email: email,
              requested_at: new Date().toLocaleString()
            },
            { publicKey: EMAILJS_ACCOUNT_2_PUBLIC_KEY }
          )
          .catch(function (err) {
            console.warn("Could not send reset-notify email:", err);
          });
      }
    });
  }

  if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const client = await requireClient();
      if (!client) return;

      const newPassword = document.getElementById("newPassword").value;
      const confirmNewPassword = document.getElementById("confirmNewPassword").value;

      setSettingsMessage(resetPasswordStatus, "", false);

      if (newPassword.length < 6) {
        setSettingsMessage(resetPasswordStatus, "Password must be at least 6 characters.", true);
        return;
      }

      if (newPassword !== confirmNewPassword) {
        setSettingsMessage(resetPasswordStatus, "Passwords do not match.", true);
        return;
      }

      resetPasswordSubmit.disabled = true;
      resetPasswordSubmit.textContent = "Saving...";

      const { error } = await client.auth.updateUser({ password: newPassword });

      resetPasswordSubmit.disabled = false;
      resetPasswordSubmit.textContent = "Save New Password";

      if (error) {
        setSettingsMessage(resetPasswordStatus, error.message, true);
        return;
      }

      isPasswordRecovery = false;
      resetPasswordForm.reset();
      enterDashboard(client);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      const client = await requireClient();
      if (!client) return;

      await client.auth.signOut();
      showOnly(loginSection);
      logoutBtn.hidden = true;
      if (settingsBtn) settingsBtn.hidden = true;
      closeSettings();
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener("click", openSettings);
  }

  if (settingsClose) {
    settingsClose.addEventListener("click", closeSettings);
  }

  if (settingsOverlay) {
    settingsOverlay.addEventListener("click", function (event) {
      if (event.target === settingsOverlay) {
        closeSettings();
      }
    });
  }

  if (changePasswordForm) {
    changePasswordForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const client = await requireClient();
      if (!client) return;

      const currentPassword = document.getElementById("currentPassword").value;
      const newPassword = document.getElementById("newPassword").value;
      const confirmPassword = document.getElementById("confirmPassword").value;

      setSettingsMessage(passwordMsg, "", false);

      if (newPassword.length < 6) {
        setSettingsMessage(passwordMsg, "New password must be at least 6 characters.", true);
        return;
      }

      if (newPassword !== confirmPassword) {
        setSettingsMessage(passwordMsg, "New password and confirmation don't match.", true);
        return;
      }

      if (!currentUserEmail) {
        setSettingsMessage(passwordMsg, "Could not verify your account. Please log out and back in.", true);
        return;
      }

      // Re-verify identity with the current password before allowing the change,
      // so a change can't happen just because a browser session was left open.
      const { error: verifyError } = await client.auth.signInWithPassword({
        email: currentUserEmail,
        password: currentPassword
      });

      if (verifyError) {
        setSettingsMessage(passwordMsg, "Current password is incorrect.", true);
        return;
      }

      const { error: updateError } = await client.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        setSettingsMessage(passwordMsg, "Could not update password: " + updateError.message, true);
        return;
      }

      setSettingsMessage(passwordMsg, "Password updated successfully.", false);
      changePasswordForm.reset();
    });
  }

  if (changeEmailForm) {
    changeEmailForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const client = await requireClient();
      if (!client) return;

      const newEmail = document.getElementById("newEmail").value.trim();

      setSettingsMessage(emailMsg, "", false);

      if (!newEmail) {
        setSettingsMessage(emailMsg, "Enter a new email address.", true);
        return;
      }

      const { error } = await client.auth.updateUser({ email: newEmail });

      if (error) {
        setSettingsMessage(emailMsg, "Could not update email: " + error.message, true);
        return;
      }

      setSettingsMessage(
        emailMsg,
        "Confirmation link sent to " + newEmail + ". The email won't change until you click it.",
        false
      );
      changeEmailForm.reset();
    });
  }
});
