const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const url = (u) => (/^https?:\/\//i.test(u || "") ? esc(u) : "");
const md = (s) => DOMPurify.sanitize(marked.parse(s || ""));
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let sb = null;
try { if (!/YOUR-/.test(CFG.URL)) sb = supabase.createClient(CFG.URL, CFG.KEY); } catch (e) { }
let projects = [];

/* Sample content shown until you add your own in admin.html */
const DEMO = {
  profile: {
    name: "Nilesh Gupta",
    tagline: "Aspiring penetration tester and SOC analyst. I break things in labs so I can defend them in production.",
    bio: "I'm a cybersecurity student who learns by doing: home labs, CTFs and detection engineering.\nMy focus is offensive security, blue-team monitoring and clear, honest reporting.\nEvery project here is a lab, CTF or authorized exercise.",
    skills: ["Penetration Testing", "Kali Linux", "Burp Suite", "Nmap", "Wireshark", "SIEM / Wazuh", "Python", "Bash", "OWASP Top 10", "Active Directory", "Malware Analysis", "Linux"],
    github_url: "https://github.com", linkedin_url: "https://linkedin.com", email: "you@example.com",
  },
  sections: [
    { title: "certifications.md", content: "- CompTIA Security+ (in progress)\n- eJPT (planned)\n- TryHackMe: Jr Penetration Tester path" },
    { title: "achievements.md", content: "- Top 5% on TryHackMe global leaderboard\n- Solved 60+ HackTheBox and picoCTF challenges\n- Built a 4-VM Active Directory home lab" },
  ],
  projects: [
    {
      demo: 1, title: "Active Directory Attack Lab", category: "Pentesting", slug: "ad-lab", description: "Built a 4-VM domain and attacked it end to end, from foothold to domain admin.", tools_used: ["Kali", "BloodHound", "Impacket", "Nmap"], github_url: "https://github.com",
      content: "## Goal\nPractice the full AD attack chain, then write detections for each step.\n\n## Method\n```bash\nnmap -sC -sV -oA scans/dc01 10.10.10.5\n```\n- Enumerated users and shares, then Kerberoasted a service account\n- Mapped attack paths with BloodHound\n\n## Findings\nWeak service-account passwords and excessive delegation gave domain admin. Remediation steps are in the report."
    },
    {
      demo: 1, title: "SIEM Detection Engineering", category: "SOC", slug: "siem", description: "Wrote Sigma rules and Wazuh alerts for brute force, persistence and lateral movement.", tools_used: ["Wazuh", "Sigma", "Elastic", "Sysmon"], github_url: "https://github.com",
      content: "## Goal\nTurn attack techniques into alerts with a low false-positive rate.\n\n## Method\n- Replayed attacks from the AD lab\n- Mapped each rule to MITRE ATT&CK\n- Tuned noisy rules over a week of logs\n\n## Result\n14 working detections with documented test cases."
    },
    {
      demo: 1, title: "Web App Pentest: Juice Shop", category: "Web Security", slug: "juice-shop", description: "Found and documented OWASP Top 10 flaws in a deliberately vulnerable app.", tools_used: ["Burp Suite", "OWASP ZAP", "SQLmap"], github_url: "https://github.com",
      content: "## Scope\nOWASP Juice Shop running locally.\n\n## Findings\n- SQL injection in the login form\n- Stored XSS in product reviews\n- Broken access control on basket IDs\n\nEach finding includes steps to reproduce, impact and a fix."
    },
    {
      demo: 1, title: "Malware Analysis Notes", category: "Malware / DFIR", slug: "malware", description: "Static and dynamic analysis of sample malware in an isolated sandbox.", tools_used: ["Ghidra", "Wireshark", "REMnux", "Procmon"], github_url: "https://github.com",
      content: "## Setup\nIsolated VM with no network route to the host.\n\n## Method\n- Static: strings, imports, disassembly\n- Dynamic: process, registry and network behavior\n\n## Output\nIOC list and a YARA rule for the sample."
    },
    {
      demo: 1, title: "CTF Write-ups", category: "CTF", slug: "ctf", description: "Walkthroughs of HackTheBox, TryHackMe and picoCTF challenges.", tools_used: ["Kali", "Python", "Ghidra", "CyberChef"], github_url: "https://github.com",
      content: "## What's inside\nStep-by-step write-ups covering web, crypto, forensics and reverse engineering.\n\nI only publish retired or practice challenges."
    },
  ],
};

function typeText(el, text) {
  if (reduce) { el.textContent = text; el.classList.remove("typing"); return; }
  let i = 0;
  const t = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(t); }, 28);
}

const get = async (table, f) => { if (!sb) return null; try { return (await f(sb.from(table))).data; } catch (e) { return null; } };

async function init() {
  $("#yr").textContent = new Date().getFullYear();
  const [p, pr, se] = await Promise.all([
    get("profile", (t) => t.select("*").eq("id", 1).maybeSingle()),
    get("projects", (t) => t.select("*").order("created_at", { ascending: false })),
    get("sections", (t) => t.select("*").order("position")),
  ]);
  let demo = false;
  const real = p && p.name && p.name !== "Your Name";
  const me = real ? p : (demo = true, DEMO.profile);
  projects = pr && pr.length ? pr : (demo = true, DEMO.projects);
  const secs = se && se.length ? se : (demo = true, DEMO.sections);

  document.title = me.name + " | Cybersecurity";
  $("#brand").textContent = (me.name || "portfolio").toLowerCase().replace(/\s+/g, "") + "@portfolio";
  $("#name").textContent = me.name || "";
  typeText($("#tag"), me.tagline || "");
  $("#bio").textContent = me.bio || "";
  $("#skills").innerHTML = (me.skills || []).map((s) => `<li>${esc(s)}</li>`).join("");
  $("#stats").innerHTML = `<li><b>${projects.length}</b>projects</li><li><b>${(me.skills || []).length}</b>skills</li>`;
  $("#links").innerHTML = [["GitHub", url(me.github_url)], ["LinkedIn", url(me.linkedin_url)], ["Resume", url(me.resume_url)], ["Email", me.email ? "mailto:" + esc(me.email) : ""]]
    .filter((l) => l[1]).map((l) => `<a href="${l[1]}" rel="noopener">${l[0]}</a>`).join("");
  if (me.photo_url) $("#photo").innerHTML = `<img src="${url(me.photo_url)}" alt="${esc(me.name)}">`;
  $("#extra").innerHTML = secs.map((s) => `<section><h3>${esc(s.title)}</h3><div class="doc">${md(s.content)}</div></section>`).join("");
  $("#grid").innerHTML = projects.map((x, i) => `<button class="card" data-i="${i}"><div class="bar"><i></i><i></i><i></i><span>~/projects/${esc(x.slug)}</span></div>${x.cover_image ? `<img src="${url(x.cover_image)}" alt="">` : ""}<div class="in"><small>[${esc(x.category)}]</small><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p></div></button>`).join("");
  if (demo) $("#demo").innerHTML = `Sample content shown. Add your own in the admin panel. ·  `;
}

$("#grid").addEventListener("click", async (e) => {
  const b = e.target.closest(".card");
  if (!b) return;
  const x = projects[b.dataset.i];
  let media = [];
  if (!x.demo && sb) { try { media = (await sb.from("project_media").select("*").eq("project_id", x.id)).data || []; } catch (err) { } }
  const links = [["GitHub", x.github_url], ["Live link", x.live_url], ["Download report (PDF)", x.report_url]]
    .filter((l) => url(l[1])).map((l) => `<a href="${url(l[1])}" rel="noopener">${l[0]}</a>`).join(" &nbsp; ");
  $("#dbody").innerHTML = `<small>[${esc(x.category)}]</small><h2>${esc(x.title)}</h2><p>${esc(x.description)}</p>
    <div class="tools">${(x.tools_used || []).map((t) => `<span>${esc(t)}</span>`).join("")}</div><p>${links}</p>
    <div class="doc">${md(x.content)}</div>
    <div class="media doc">${media.map((m) => m.type === "video" ? `<video src="${url(m.file_url)}" controls></video>` : m.type === "pdf" ? `<a href="${url(m.file_url)}" rel="noopener">${esc(m.caption || "PDF")}</a>` : `<img src="${url(m.file_url)}" alt="${esc(m.caption)}">`).join("")}</div>`;
  $("#dlg").showModal();
});
$("#close").onclick = () => $("#dlg").close();
$("#dlg").addEventListener("click", (e) => { if (e.target.id === "dlg") e.target.close(); });

$("#cf").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target), msg = $("#cmsg"), btn = e.target.querySelector("button");
  if (f.get("website")) return; // honeypot: bots fill this hidden field
  if (!sb) { msg.textContent = "Demo mode: add your Supabase keys in config.js to receive messages."; return; }
  btn.disabled = true; msg.textContent = "Sending…";
  const { error } = await sb.from("messages").insert({ name: f.get("name").trim(), email: f.get("email").trim(), message: f.get("message").trim() });
  btn.disabled = false;
  if (error) { msg.textContent = "Could not send. Please try again."; return; }
  e.target.reset(); msg.textContent = "Message sent. Thank you!";
});

/* Matrix rain background */
(function () {
  const c = $("#rain");
  if (!c || reduce) return;
  const x = c.getContext("2d"), chars = "अआइईउऊऋएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसहॐ", code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz{}[]()<>/;:=+*&|!?$#@", fs = 16;
  let drops, bits;
  const size = () => { c.width = innerWidth; c.height = innerHeight; drops = Array.from({ length: Math.ceil(c.width / fs) }, () => Math.random() * -50); bits = drops.map(() => Math.floor(Math.random() * 3)); };
  size(); addEventListener("resize", size);
  setInterval(() => {
    const s = getComputedStyle(document.documentElement);
    x.fillStyle = s.getPropertyValue("--bg").trim() + "18";
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = s.getPropertyValue("--acc").trim();
    x.font = fs + "px monospace";
    drops.forEach((y, i) => {
      const pool = [chars, "01", code][bits[i]];
      x.fillText(pool[Math.floor(Math.random() * pool.length)], i * fs, y * fs);
      drops[i] = y * fs > c.height && Math.random() > 0.975 ? 0 : y + 1;
    });
  }, 55);
})();

init();
