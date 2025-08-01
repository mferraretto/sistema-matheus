// expose-uid.js
window.addEventListener("message", (event) => {
  if (event.data === "getShopeeUser") {
    const uid = window.sistema?.uid || null;
    const passphrase = sessionStorage.getItem("senhaCripto") || null;

    event.source.postMessage({
      type: "shopeeUserInfo",
      uid,
      passphrase
    }, event.origin);
  }
});
