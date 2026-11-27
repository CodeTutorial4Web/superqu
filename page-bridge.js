
document.addEventListener("qureo:set-ace-value", (e) => {
    const { id, value } = JSON.parse(e.detail);
    const el = document.getElementById(id);

    if (!el) {
        console.warn("[bridge] Editor element not found:", id);
        return;
    }

    const editor = el.env?.editor ??
        (window.ace ? window.ace.edit(el) : null);

    if (!editor) {
        console.warn("[bridge] Ace instance not found:", id);
        return;
    }

    console.log("Before:", editor.getValue());

    editor.setValue(value, -1);

    console.log("After:", editor.getValue());
    console.log("Session:", editor.session.getValue());

    // Verify Ace accepted the new value.
    console.log("[bridge] Value updated:", editor.getValue());

    // Notify Ace's listeners.
    editor.session._emit("change");

    editor.resize();
});