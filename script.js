// Configuration: repository details
const owner = 'MeshJS';
const repo = 'cardano-governance';

// When the DOM is loaded, start processing.
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 1. Fetch the voting history markdown file
    const votingHistoryUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/voting-history/2025/2025-votes.md`;
    console.log("Fetching voting history from:", votingHistoryUrl);
    const votingHistoryResponse = await fetch(votingHistoryUrl);
    if (!votingHistoryResponse.ok) {
      throw new Error("Error fetching voting history markdown");
    }
    const votingHistoryText = await votingHistoryResponse.text();

    // Extract the last 4 characters (suffixes) of each Action ID in the markdown.
    const votedSuffixes = extractActionIDSuffixes(votingHistoryText);
    console.log("Voted suffixes:", votedSuffixes);

    // 2. Fetch the proposals.json file
    const proposalsUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/vote-context/proposals.json`;
    console.log("Fetching proposals from:", proposalsUrl);
    const proposalsResponse = await fetch(proposalsUrl);
    if (!proposalsResponse.ok) {
      throw new Error("Error fetching proposals.json");
    }
    const proposals = await proposalsResponse.json();

    // 3. Fetch the vote-context directories
    const voteContextUrl = `https://api.github.com/repos/${owner}/${repo}/contents/vote-context/2025`;
    console.log("Fetching vote-context from:", voteContextUrl);
    const voteContextResponse = await fetch(voteContextUrl);
    if (!voteContextResponse.ok) {
      throw new Error("Error fetching vote-context directories");
    }
    const voteContextData = await voteContextResponse.json();

    // 4. Filter for proposals that have NOT been voted on.
    // Assumption: each directory name is like "547_2k80" where the part after "_" is the suffix.
    const pendingProposals = voteContextData.filter(item => {
      if (item.type !== "dir") return false;
      const parts = item.name.split('_');
      if (parts.length < 2) return false;
      const suffix = parts[1];
      // Proposal is pending if its suffix does NOT appear in the votedSuffixes list.
      return !votedSuffixes.includes(suffix);
    });

    // 5. Display the pending proposals as cards with titles
    displayPendingProposals(pendingProposals, proposals);

  } catch (error) {
    console.error(error);
    document.getElementById("pending-proposals").innerHTML =
      `<p>Error loading proposals: ${error.message}</p>`;
  }
});

/**
 * Extracts the last 4 characters of each Action ID from the markdown text.
 * Assumes that each proposal is rendered as a markdown table row like:
 *
 * | Action ID      | gov_action12meeq4r43udremwpm6fzt4nt7fctvt0ah7798x036m2r4nhlccmqqhmr9wx |
 *
 * and that the Action ID is always in the second cell.
 */
function extractActionIDSuffixes(markdown) {
  const suffixes = [];
  const lines = markdown.split("\n");

  lines.forEach(line => {
    // Check if the line contains "Action ID"
    if (line.includes("Action ID")) {
      // Split by the pipe delimiter
      const parts = line.split("|").map(part => part.trim());
      // Expecting parts[0] empty, parts[1] "Action ID", parts[2] to be the actual ID.
      if (parts.length >= 3 && parts[1] === "Action ID") {
        const actionId = parts[2];
        // Get the last 4 characters of the action ID.
        const suffix = actionId.slice(-4);
        suffixes.push(suffix);
      }
    }
  });
  return suffixes;
}

/**
 * Displays pending proposals as cards with titles and buttons.
 * When a button is clicked, it opens the GitHub edit page for that proposal's JSON file.
 */
function displayPendingProposals(proposals, proposalsData) {
  const container = document.getElementById("pending-proposals");
  container.innerHTML = ""; // Clear any loading text.

  if (proposals.length === 0) {
    container.innerHTML = "<p>No pending proposals. All proposals have been voted on!</p>";
    return;
  }

  // Create a container for the cards
  const cardsContainer = document.createElement("div");
  cardsContainer.style.display = "grid";
  cardsContainer.style.gridTemplateColumns = "repeat(auto-fill, minmax(300px, 1fr))";
  cardsContainer.style.gap = "20px";
  cardsContainer.style.padding = "20px";

  proposals.forEach(proposal => {
    // Create a card container for each proposal
    const card = document.createElement("div");
    card.style.border = "1px solid #ddd";
    card.style.borderRadius = "8px";
    card.style.padding = "15px";
    card.style.backgroundColor = "#fff";
    card.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";

    // Find the matching proposal data
    const proposalData = proposalsData.find(p =>
      p.action_id.includes(proposal.name.split('_')[1])
    );

    // Create title element
    const title = document.createElement("h3");
    title.textContent = proposalData ? proposalData.title : "Untitled Proposal";
    title.style.margin = "0 0 15px 0";
    title.style.fontSize = "1.1em";
    title.style.color = "#333";

    // Create buttons container
    const buttonsContainer = document.createElement("div");
    buttonsContainer.style.display = "flex";
    buttonsContainer.style.flexDirection = "column";
    buttonsContainer.style.gap = "10px";

    // Create the main proposal button
    const btn = document.createElement("button");
    btn.textContent = "Enter Proposal Rationale";
    btn.style.padding = "8px 12px";
    btn.style.backgroundColor = "#0366d6";
    btn.style.color = "white";
    btn.style.border = "none";
    btn.style.borderRadius = "4px";
    btn.style.cursor = "pointer";

    // When clicked, open the GitHub edit page
    btn.addEventListener("click", () => {
      const editUrl = `https://github.com/${owner}/${repo}/edit/main/vote-context/2025/${proposal.name}/Vote_Context.jsonId`;
      window.open(editUrl, "_blank");
    });

    // Create the copy button
    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy raw GitHub path URL";
    copyBtn.style.padding = "8px 12px";
    copyBtn.style.backgroundColor = "#f6f8fa";
    copyBtn.style.border = "1px solid #ddd";
    copyBtn.style.borderRadius = "4px";
    copyBtn.style.cursor = "pointer";

    // When clicked, copy the raw GitHub URL to clipboard
    copyBtn.addEventListener("click", () => {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/vote-context/2025/${proposal.name}/Vote_Context.jsonId`;
      navigator.clipboard.writeText(rawUrl).then(() => {
        // Optional: Show a brief success message
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
      });
    });

    // Add elements to the card
    buttonsContainer.appendChild(btn);
    buttonsContainer.appendChild(copyBtn);
    card.appendChild(title);
    card.appendChild(buttonsContainer);

    // Add the card to the cards container
    cardsContainer.appendChild(card);
  });

  // Add the cards container to the main container
  container.appendChild(cardsContainer);
}
