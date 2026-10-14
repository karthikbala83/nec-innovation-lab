// Step-by-step: create a fine-grained, READ-ONLY GitHub token for one private repo.
// Shown in the wizard's Code step; the same text lives in docs/STUDENT_GUIDE.md.
export default function GithubTokenHelp({ repo }) {
  return (
    <div className="token-help">
      <p><strong>Your repo is private?</strong> Give the portal a token that can only <em>read</em> this one repository. It is used once for the import and then thrown away — never saved.</p>
      <ol>
        <li>On GitHub (signed in as the repo owner) open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">Settings → Developer settings → Personal access tokens → Fine-grained tokens → <strong>Generate new token</strong> ↗</a></li>
        <li><strong>Token name:</strong> <code>nec-innovation-lab</code> · <strong>Expiration:</strong> 7 days</li>
        <li><strong>Resource owner:</strong> you (or your team's organisation, if the repo belongs to one — an org admin may need to approve it).</li>
        <li><strong>Repository access:</strong> <em>Only select repositories</em> → pick <code>{repo || 'your project repo'}</code>.</li>
        <li><strong>Permissions → Repository permissions → Contents:</strong> <em>Read-only</em>. (Metadata: Read-only is added automatically.) Leave everything else as <em>No access</em>.</li>
        <li>Click <strong>Generate token</strong> and copy it (it starts with <code>github_pat_</code>). Paste it below and import.</li>
        <li>Done? You can delete the token on GitHub right away. For later re-imports, make a new one the same way.</li>
      </ol>
      <p className="muted small">Never paste a token anywhere else, never give it write access, and never commit it to your code. The public page shows your stack and commit counts only — not your code.</p>
    </div>
  );
}
