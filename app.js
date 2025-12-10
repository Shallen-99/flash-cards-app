const STORAGE_KEY = "flashcards-state-v1";

let state = {
  decks: [],
  cardsByDeckId: {},
  activeDeckId: null,
  studyIndex: 0,
  searchQuery: "",
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (err) {
    console.warn("Bad state:", err);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function getActiveDeck() {
  return state.decks.find((d) => d.id === state.activeDeckId) || null;
}

function getCards(deckId) {
  return state.cardsByDeckId[deckId] || [];
}

function createDeck(name) {
  const id = crypto.randomUUID();
  state.decks.push({ id, name, createdAt: Date.now() });
  state.cardsByDeckId[id] = [];
  state.activeDeckId = id;
  saveState();
  render();
}

function updateDeck(id, newName) {
  const deck = state.decks.find((d) => d.id === id);
  if (!deck) return;
  deck.name = newName;
  saveState();
  render();
}

function deleteDeck(id) {
  state.decks = state.decks.filter((d) => d.id !== id);
  delete state.cardsByDeckId[id];

  if (state.activeDeckId === id) {
    state.activeDeckId = state.decks[0]?.id || null;
  }

  saveState();
  render();
}

function createCard(deckId, front, back) {
  const cards = state.cardsByDeckId[deckId] || [];
  cards.push({
    id: crypto.randomUUID(),
    front,
    back,
    updatedAt: Date.now(),
  });
  saveState();
  render();
}

function updateCard(deckId, cardId, front, back) {
  const cards = getCards(deckId);
  const card = cards.find((c) => c.id === cardId);
  if (!card) return;
  card.front = front;
  card.back = back;
  card.updatedAt = Date.now();
  saveState();
  render();
}

function deleteCard(deckId, cardId) {
  const cards = getCards(deckId);
  state.cardsByDeckId[deckId] = cards.filter((c) => c.id !== cardId);
  saveState();
  render();
}

const modal = $("#modal");
const modalContent = $(".modal-content");
const modalForm = $("#modal-form");
const modalTitle = $("#modal-title");
const modalClose = $("#modal-close");

let lastFocused = null;

function openModal({ title, content, onSubmit }) {
  modalTitle.textContent = title;
  modalForm.innerHTML = content;
  modalForm.onsubmit = (e) => {
    e.preventDefault();
    onSubmit(new FormData(modalForm));
  };

  lastFocused = document.activeElement;

  modal.classList.remove("hidden");
  trapFocus();
}

function closeModal() {
  modal.classList.add("hidden");
  modalForm.innerHTML = "";
  if (lastFocused) lastFocused.focus();
}

modalClose.onclick = closeModal;

modal.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

function trapFocus() {
  const focusEls = modal.querySelectorAll(
    "button, input, textarea, [tabindex]:not([tabindex='-1'])"
  );
  const first = focusEls[0];
  const last = focusEls[focusEls.length - 1];

  first.focus();

  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

function renderDeckList() {
  const ul = $("#deck-list");
  ul.innerHTML = "";

  if (state.decks.length === 0) {
    ul.innerHTML = `<li>No decks yet</li>`;
    return;
  }

  state.decks.forEach((deck) => {
    const li = document.createElement("li");
    li.textContent = deck.name;
    li.dataset.id = deck.id;

    if (deck.id === state.activeDeckId) li.classList.add("active");

    li.onclick = () => {
      state.activeDeckId = deck.id;
      state.searchQuery = "";
      $("#search-input").value = "";
      saveState();
      render();
    };

    li.oncontextmenu = (e) => {
      e.preventDefault();
      openEditDeckModal(deck);
    };

    ul.appendChild(li);
  });
}

function renderDeckTitle() {
  const deck = getActiveDeck();
  $("#deck-title").textContent = deck ? deck.name : "Select a deck";
}

function renderCardList() {
  const deck = getActiveDeck();
  const list = $("#card-list");
  list.innerHTML = "";

  if (!deck) return;

  let cards = getCards(deck.id);

  if (state.searchQuery.trim()) {
    cards = cards.filter((c) =>
      (c.front + c.back).toLowerCase().includes(state.searchQuery.toLowerCase())
    );
  }

  if (cards.length === 0) {
    list.innerHTML = `<p>No cards found.</p>`;
    return;
  }

  cards.forEach((card) => {
    const div = document.createElement("div");
    div.className = "card-item";

    div.innerHTML = `
      <div class="card-item-header">
        <strong>${card.front}</strong>
        <div class="card-item-actions">
          <button data-edit="${card.id}" class="btn">Edit</button>
          <button data-del="${card.id}" class="btn" style="background:#dc2626">Delete</button>
        </div>
      </div>
      <p>${card.back}</p>
    `;

    div.querySelector("[data-edit]").onclick = () =>
      openEditCardModal(deck.id, card);

    div.querySelector("[data-del]").onclick = () => {
      if (confirm("Delete card?")) deleteCard(deck.id, card.id);
    };

    list.appendChild(div);
  });
}

function renderStudyCard() {
  const deck = getActiveDeck();
  const front = $(".card-front");
  const back = $(".card-back");

  if (!deck) return;

  const cards = getCards(deck.id);
  if (cards.length === 0) {
    front.textContent = "No cards.";
    back.textContent = "";
    return;
  }

  const card = cards[state.studyIndex];
  front.textContent = card.front;
  back.textContent = card.back;
}

$("#flip-btn").onclick = () => {
  $("#study-card").classList.toggle("flipped");
};
$("#study-card").onclick = () => $("#study-card").classList.toggle("flipped");

$("#prev-btn").onclick = () => {
  const deck = getActiveDeck();
  if (!deck) return;
  const cards = getCards(deck.id);
  state.studyIndex = (state.studyIndex - 1 + cards.length) % cards.length;
  $("#study-card").classList.remove("flipped");
  renderStudyCard();
};

$("#next-btn").onclick = () => {
  const deck = getActiveDeck();
  if (!deck) return;
  const cards = getCards(deck.id);
  state.studyIndex = (state.studyIndex + 1) % cards.length;
  $("#study-card").classList.remove("flipped");
  renderStudyCard();
};

$("#shuffle-btn").onclick = () => {
  const deck = getActiveDeck();
  if (!deck) return;

  const cards = getCards(deck.id);
  cards.sort(() => Math.random() - 0.5);

  state.studyIndex = 0;
  saveState();
  render();
};

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    $("#study-card").classList.toggle("flipped");
  } else if (e.key === "ArrowRight") {
    $("#next-btn").click();
  } else if (e.key === "ArrowLeft") {
    $("#prev-btn").click();
  }
});

function openNewDeckModal() {
  openModal({
    title: "New Deck",
    content: `
      <label>Deck Name</label>
      <input name="name" class="input" required />
      <button class="btn" type="submit" style="margin-top:1rem;">Create</button>
    `,
    onSubmit(form) {
      createDeck(form.get("name").trim());
      closeModal();
    },
  });
}

function openEditDeckModal(deck) {
  openModal({
    title: "Edit Deck",
    content: `
      <label>Name</label>
      <input name="name" class="input" value="${deck.name}" required />
      <button class="btn" type="submit" style="margin-top:1rem;">Save</button>
      <button id="del-deck-btn" class="btn" style="background:#dc2626;margin-top:1rem;">Delete Deck</button>
    `,
    onSubmit(form) {
      updateDeck(deck.id, form.get("name").trim());
      closeModal();
    },
  });

  $("#del-deck-btn").onclick = () => {
    if (confirm("Delete this deck?")) {
      deleteDeck(deck.id);
      closeModal();
    }
  };
}

function openNewCardModal(deckId) {
  openModal({
    title: "New Card",
    content: `
      <label>Front</label>
      <textarea name="front" class="input" required></textarea>
      <label>Back</label>
      <textarea name="back" class="input" required></textarea>
      <button class="btn" type="submit" style="margin-top:1rem;">Create</button>
    `,
    onSubmit(form) {
      createCard(deckId, form.get("front"), form.get("back"));
      closeModal();
    },
  });
}

function openEditCardModal(deckId, card) {
  openModal({
    title: "Edit Card",
    content: `
      <label>Front</label>
      <textarea name="front" class="input" required>${card.front}</textarea>
      <label>Back</label>
      <textarea name="back" class="input" required>${card.back}</textarea>
      <button class="btn" type="submit" style="margin-top:1rem;">Save</button>
      <button id="delete-card-btn" class="btn" style="background:#dc2626;margin-top:1rem;">Delete</button>
    `,
    onSubmit(form) {
      updateCard(deckId, card.id, form.get("front"), form.get("back"));
      closeModal();
    },
  });

  $("#delete-card-btn").onclick = () => {
    if (confirm("Delete this card?")) {
      deleteCard(deckId, card.id);
      closeModal();
    }
  };
}

$("#new-deck-btn").onclick = openNewDeckModal;

$("#new-card-btn").onclick = () => {
  const deck = getActiveDeck();
  if (!deck) return alert("Select a deck first.");
  openNewCardModal(deck.id);
};

$("#search-input").oninput = (e) => {
  state.searchQuery = e.target.value;
  render();
};

function render() {
  renderDeckList();
  renderDeckTitle();
  renderCardList();
  renderStudyCard();
}

loadState();
render();
