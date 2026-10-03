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
const assetsStatus = document.getElementById("assetsStatus");
const adminAssetGrid = document.getElementById("adminAssetGrid");
const adminAssetTemplate = document.getElementById("adminAssetTemplate");
const feedbackListStatus = document.getElementById("feedbackListStatus");
const adminFeedbackList = document.getElementById("adminFeedbackList");
const feedbackItemTemplate = document.getElementById("feedbackItemTemplate");

const ASSET_LABELS = {
  logo: "Site Logo",
  heroImage: "Hero Photo (homepage top)",
  gallery1: "Showcase Photo 1",
  gallery2: "Showcase Photo 2",
  gallery3: "Showcase Photo 3",
  gallery4: "Showcase Photo 4",
  ornamentLook1: "Ornament Design 1 (\"Look 1\")",
  ornamentLook2: "Ornament Design 2 (\"Look 2\")",
  ornamentLook3: "Ornament Design 3 (\"Look 3\")",
  ornamentLook4: "Ornament Design 4 (\"Look 4\")"
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
  await loadFeedback(client);
  await loadSiteAssets(client);
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
    .select("key, name, price, image_url")
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
function setupImagePreview(fileInput, imgEl, pendingBadge, cancelBtn, statusEl) {
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
  });

  return {
    markSaved: function (newSrc) {
      savedSrc = newSrc || imgEl.src;
      pendingBadge.hidden = true;
      cancelBtn.hidden = true;
    }
  };
}

function renderProductCard(client, row) {
  const node = adminProductTemplate.content.cloneNode(true);
  const img = node.querySelector(".admin-product-image img");
  const pendingBadge = node.querySelector(".admin-pending-badge");
  const nameEl = node.querySelector(".admin-product-name");
  const priceInput = node.querySelector(".admin-price-input");
  const fileInput = node.querySelector(".admin-file-input");
  const saveBtn = node.querySelector(".admin-save-btn");
  const cancelBtn = node.querySelector(".admin-cancel-btn");
  const statusEl = node.querySelector(".admin-card-status");

  img.src = row.image_url || "";
  img.alt = row.name || row.key;
  nameEl.textContent = row.name || row.key;
  priceInput.value =
    row.price !== null && row.price !== undefined ? row.price : "";

  const preview = setupImagePreview(fileInput, img, pendingBadge, cancelBtn, statusEl);

  saveBtn.addEventListener("click", function () {
    saveProduct(client, row.key, priceInput, fileInput, saveBtn, statusEl, img, preview);
  });

  adminProductGrid.appendChild(node);
}

async function saveProduct(client, key, priceInput, fileInput, saveBtn, statusEl, imgEl, preview) {
  const newPrice = parseFloat(priceInput.value);

  if (Number.isNaN(newPrice) || newPrice < 0) {
    statusEl.textContent = "Enter a valid price.";
    statusEl.className = "admin-card-status is-error";
    return;
  }

  saveBtn.disabled = true;
  statusEl.textContent = "Saving...";
  statusEl.className = "admin-card-status";

  try {
    const updatePayload = {
      price: newPrice,
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
    .select("id, name, email, rating, message, is_read, created_at")
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
  const saveBtn = node.querySelector(".admin-save-btn");
  const cancelBtn = node.querySelector(".admin-cancel-btn");
  const statusEl = node.querySelector(".admin-card-status");

  const label = ASSET_LABELS[row.key] || row.key;

  img.src = row.image_url || "";
  img.alt = label;
  nameEl.textContent = label;

  const preview = setupImagePreview(fileInput, img, pendingBadge, cancelBtn, statusEl);

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
