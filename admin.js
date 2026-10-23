const sb = supabase.createClient(CFG.URL, CFG.KEY);
const $ = (s) => document.querySelector(s);
const app = $("#app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const csv = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
const OK = ["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/webm", "application/pdf"];
let tab = "projects", editing = null, note = "";

async function up(file, folder) {
  if (!file || !file.size) return null;
  if (!OK.includes(file.type)) throw new Error("File type not allowed: " + file.name);
  if (file.size > 25 * 1048576) throw new Error("Max 25 MB: " + file.name);
  const path = `${folder}/${crypto.randomUUID()}.${file.name.split(".").pop().toLowerCase()}`;
  const { error } = await sb.storage.from("portfolio").upload(path, file);
  if (error) throw error;
  return sb.storage.from("portfolio").getPublicUrl(path).data.publicUrl;
}

// field helpers
const T = (label, name, v = "", type = "text") => `<label>${label}<input name="${name}" type="${type}" value="${esc(v)}"></label>`;
const A = (label, name, v = "") => `<label>${label}<textarea name="${name}" rows="7">${esc(v)}</textarea></label>`;
const F = (label, name, multi) => `<label>${label}<input name="${name}" type="file" ${multi ? "multiple" : ""}></label>`;
const C = (label, name, on) => `<label><span><input name="${name}" type="checkbox" style="width:auto" ${on ? "checked" : ""}> ${label}</span></label>`;

async function render() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return login();
  app.innerHTML = `<h1 style="font-size:2rem">Dashboard</h1><button class="lnk" id="out">Log out</button>
    <div class="tabs">${["projects", "profile", "sections", "messages"].map((t) => `<button class="${t === tab ? "on" : ""}" data-t="${t}">${t}</button>`).join("")}</div><div id="pane"></div>`;
  $("#out").onclick = async () => { await sb.auth.signOut(); render(); };
  app.querySelector(".tabs").onclick = (e) => { if (e.target.dataset.t) { tab = e.target.dataset.t; editing = null; note = ""; render(); } };
  await { projects, profile, sections, messages }[tab]();
}

function login() {
  app.innerHTML = `<h1 style="font-size:2rem">Admin login</h1><form id="lf">${T("Email", "email", "", "email")}${T("Password", "password", "", "password")}<button class="btn">Sign in</button><p id="le"></p></form>`;
  $("#lf").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const { error } = await sb.auth.signInWithPassword({ email: f.get("email"), password: f.get("password") });
    if (error) $("#le").textContent = "Login failed."; else render();
  };
}

// run a save action with feedback; on error keep the form so nothing typed is lost
async function guard(e, fn) {
  e.preventDefault();
  const form = e.target, btn = form.querySelector("button.btn"); btn.disabled = true;
  try { await fn(new FormData(form)); note = "Saved."; editing = null; render(); }
  catch (err) { btn.disabled = false; const p = form.querySelector("p:last-child"); if (p) p.textContent = err.message || String(err); }
}

/* ---------- Projects ---------- */
const urlPath = (u) => (u || "").split("/object/public/portfolio/")[1];
async function rmFiles(urls) {
  const paths = urls.map(urlPath).filter(Boolean);
  if (paths.length) await sb.storage.from("portfolio").remove(paths);
}
const chk = (error) => { if (error) throw new Error(error.code === "23505" ? "That slug is already used. Choose a different title or slug." : error.message); };

async function projects() {
  const { data: list } = await sb.from("projects").select("*").order("created_at", { ascending: false });
  const p = editing || {};
  const media = editing ? (await sb.from("project_media").select("*").eq("project_id", editing.id)).data || [] : [];
  const cb = (n, t) => `<span><input type="checkbox" name="${n}" style="width:auto"> ${t}</span>`;
  $("#pane").innerHTML = `<form id="f"><h2>${editing ? "Edit: " + esc(p.title) : "Add project"}</h2>
    ${T("Title", "title", p.title)}${T("Slug (optional)", "slug", p.slug)}${T("Short description", "description", p.description)}
    ${A("Full write-up (Markdown)", "content", p.content)}${T("Category (Pentesting, DFIR, CTF...)", "category", p.category)}
    ${T("Tools used (comma separated)", "tools", (p.tools_used || []).join(", "))}${T("GitHub URL", "github_url", p.github_url)}${T("Live / other URL", "live_url", p.live_url)}
    ${p.cover_image ? `<label>Current cover<img src="${esc(p.cover_image)}" alt="" style="max-width:220px;border-radius:4px">${cb("rm_cover", "Remove cover")}</label>` : ""}
    ${F("Cover image" + (p.cover_image ? " (choose a file to replace)" : ""), "cover")}
    ${p.report_url ? `<label>Current report<a href="${esc(p.report_url)}" target="_blank" rel="noopener">Open report</a>${cb("rm_report", "Remove report")}</label>` : ""}
    ${F("Report (PDF)" + (p.report_url ? " (choose a file to replace)" : ""), "report")}
    ${media.length ? `<div>Current media</div><ul>${media.map((m) => `<li><span>${esc(m.type)}: ${esc(m.caption || "")}</span><span><a href="${esc(m.file_url)}" target="_blank" rel="noopener">View</a> <button type="button" class="del" data-m="${m.id}">Remove</button></span></li>`).join("")}</ul>` : ""}
    ${F("Add media: images, videos, PDFs (multiple)", "media", true)}
    ${C("Published (visible to public)", "published", p.published)}
    <div><button class="btn">${editing ? "Update project" : "Save project"}</button> ${editing ? `<button type="button" class="lnk" id="cx">Cancel edit</button>` : ""}</div><p>${esc(note)}</p></form>
    <h2>Your projects (${(list || []).length})</h2><ul>${(list || []).map((x) => `<li><span>${esc(x.title)} <em class="muted">${x.published ? "published" : "draft"}</em></span><span><button data-e="${x.id}">Edit</button> <button data-t="${x.id}">${x.published ? "Unpublish" : "Publish"}</button> <button class="del" data-d="${x.id}">Delete</button></span></li>`).join("")}</ul>`;
  if ($("#cx")) $("#cx").onclick = () => { editing = null; note = ""; render(); };

  $("#pane").onclick = async (e) => {
    const d = e.target.dataset, x = list.find((y) => y.id === (d.e || d.t || d.d));
    if (d.e) { editing = x; note = ""; render(); window.scrollTo(0, 0); }
    else if (d.t) { await sb.from("projects").update({ published: !x.published }).eq("id", x.id); render(); }
    else if (d.m) {
      if (!confirm("Remove this media file?")) return;
      const m = media.find((y) => y.id === d.m);
      await rmFiles([m.file_url]); await sb.from("project_media").delete().eq("id", m.id);
      e.target.closest("li").remove();
    } else if (d.d && confirm(`Delete "${x.title}" and all its files? This cannot be undone.`)) {
      const { data: mm } = await sb.from("project_media").select("file_url").eq("project_id", x.id);
      await rmFiles([x.cover_image, x.report_url, ...(mm || []).map((m) => m.file_url)]);
      chk((await sb.from("projects").delete().eq("id", x.id)).error);
      if (editing?.id === x.id) editing = null;
      render();
    }
  };

  $("#f").onsubmit = (e) => guard(e, async (f) => {
    const title = f.get("title").trim();
    if (!title) throw new Error("Title is required.");
    const row = {
      title, slug: (f.get("slug").trim() || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      description: f.get("description").trim(), content: f.get("content"), category: f.get("category").trim(),
      tools_used: csv(f.get("tools")), github_url: f.get("github_url").trim(), live_url: f.get("live_url").trim(),
      published: f.get("published") === "on",
    };
    const old = [];
    const cover = await up(f.get("cover"), "covers");
    if (cover || f.get("rm_cover")) { row.cover_image = cover; old.push(p.cover_image); }
    const report = await up(f.get("report"), "reports");
    if (report || f.get("rm_report")) { row.report_url = report; old.push(p.report_url); }
    let id = editing?.id;
    if (id) chk((await sb.from("projects").update(row).eq("id", id)).error);
    else { const r = await sb.from("projects").insert(row).select("id").single(); chk(r.error); id = r.data.id; }
    await rmFiles(old);
    for (const m of f.getAll("media").filter((y) => y.size)) {
      const file_url = await up(m, "media");
      const type = m.type.startsWith("video") ? "video" : m.type === "application/pdf" ? "pdf" : "image";
      chk((await sb.from("project_media").insert({ project_id: id, file_url, type, caption: m.name })).error);
    }
  });
}

/* ---------- Profile ---------- */
async function profile() {
  const { data: p } = await sb.from("profile").select("*").eq("id", 1).single();
  $("#pane").innerHTML = `<form id="f"><h2>My info</h2>${T("Name", "name", p.name)}${T("Tagline", "tagline", p.tagline)}${A("Bio", "bio", p.bio)}
    ${T("Public email", "email", p.email)}${T("GitHub URL", "github_url", p.github_url)}${T("LinkedIn URL", "linkedin_url", p.linkedin_url)}
    ${T("Skills (comma separated)", "skills", (p.skills || []).join(", "))}${F("Profile photo", "photo")}${F("Resume (PDF)", "resume")}
    <div><button class="btn">Save profile</button></div><p>${esc(note)}</p></form>`;
  $("#f").onsubmit = (e) => guard(e, async (f) => {
    const row = { name: f.get("name").trim(), tagline: f.get("tagline").trim(), bio: f.get("bio"), email: f.get("email").trim(), github_url: f.get("github_url").trim(), linkedin_url: f.get("linkedin_url").trim(), skills: csv(f.get("skills")) };
    const ph = await up(f.get("photo"), "profile"); if (ph) row.photo_url = ph;
    const rs = await up(f.get("resume"), "profile"); if (rs) row.resume_url = rs;
    const { error } = await sb.from("profile").update(row).eq("id", 1); if (error) throw error;
  });
}

/* ---------- Sections ("add anything") ---------- */
async function sections() {
  const { data: list } = await sb.from("sections").select("*").order("position");
  const s = editing || {};
  $("#pane").innerHTML = `<form id="f"><h2>${editing ? "Edit section" : "Add a section"}</h2><p class="muted">Certifications, achievements, bug bounties, awards, anything. Shown in the About area.</p>
    ${T("Title", "title", s.title)}${A("Content (Markdown)", "content", s.content)}${T("Position (0 shows first)", "position", s.position ?? 0, "number")}${C("Visible", "visible", s.visible ?? true)}
    <div><button class="btn">Save section</button> ${editing ? `<button type="button" class="lnk" id="cx">Cancel edit</button>` : ""}</div><p>${esc(note)}</p></form>
    <ul>${(list || []).map((x) => `<li><span>${x.position}. ${esc(x.title)} ${x.visible ? "" : "(hidden)"}</span><span><button data-e="${x.id}">Edit</button> <button class="del" data-d="${x.id}">Delete</button></span></li>`).join("")}</ul>`;
  if ($("#cx")) $("#cx").onclick = () => { editing = null; render(); };
  $("#pane").onclick = async (e) => {
    if (e.target.dataset.e) { editing = list.find((x) => x.id === e.target.dataset.e); render(); }
    if (e.target.dataset.d && confirm("Delete this section?")) { await sb.from("sections").delete().eq("id", e.target.dataset.d); render(); }
  };
  $("#f").onsubmit = (e) => guard(e, async (f) => {
    const row = { title: f.get("title").trim(), content: f.get("content"), position: Number(f.get("position")) || 0, visible: f.get("visible") === "on" };
    const { error } = editing ? await sb.from("sections").update(row).eq("id", editing.id) : await sb.from("sections").insert(row);
    if (error) throw error;
  });
}

/* ---------- Messages ---------- */
async function messages() {
  const { data } = await sb.from("messages").select("*").order("created_at", { ascending: false });
  $("#pane").innerHTML = `<h2>Contact messages</h2>` + ((data || []).length ? data.map((m) => `<div class="msg"><strong>${esc(m.name)}</strong> · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a> · ${new Date(m.created_at).toLocaleString()}<br>${esc(m.message)}<br><button class="lnk del" data-d="${m.id}">Delete</button></div>`).join("") : `<p class="muted">No messages yet.</p>`);
  $("#pane").onclick = async (e) => { if (e.target.dataset.d) { await sb.from("messages").delete().eq("id", e.target.dataset.d); render(); } };
}

render();
