const placements = {
  image: [null, null, null, null, null, null],
  caption: [null, null, null, null, null, null]
};

const checks = [false, false, false, false, false, false];

let draggedElement = null;
let draggedType = null;

// 🔑 Get group from URL query parameter (e.g. ?group=1)
let currentSessionId = "live-room";
const urlParams = new URLSearchParams(window.location.search);
const groupParam = urlParams.get("group");
if (groupParam) {
  currentSessionId = "group-" + groupParam;
}

document.addEventListener("DOMContentLoaded", () => {
  const dropZones = document.querySelectorAll(".drop-zone");
  const allBanks = document.querySelectorAll(".drag-items");
  const passwordField = document.getElementById("passwordField");

  function attachDragEvents(el) {
    el.setAttribute("draggable", "true");

    el.addEventListener("dragstart", () => {
      draggedElement = el;
      const parentBank = el.closest(".drag-items");
      draggedType = parentBank ? parentBank.dataset.type : el.closest(".drop-zone")?.dataset.type;
      el.classList.add("dragging");
      setTimeout(() => el.classList.add("hidden"), 0);
    });

    el.addEventListener("dragend", () => {
      if (draggedElement) draggedElement.classList.remove("hidden", "dragging");
      draggedElement = null;
      draggedType = null;
    });
  }

  document.querySelectorAll(".draggable").forEach(attachDragEvents);

  dropZones.forEach(zone => {
    zone.addEventListener("dragover", e => e.preventDefault());

    zone.addEventListener("drop", () => {
      if (!draggedElement) return;

      const slot = +zone.dataset.slot;
      const zoneType = zone.dataset.type;

      if (zoneType !== draggedType) return;
      if (zone.classList.contains("locked")) return;

      if (zone.firstChild) {
        const existingItem = zone.firstChild;
        const correctBank = document.querySelector(`.drag-items[data-type="${zoneType}"]`);
        if (correctBank) correctBank.appendChild(existingItem);
      }

      ["image", "caption"].forEach(type => {
        placements[type] = placements[type].map(id =>
          id === draggedElement.dataset.id ? null : id
        );
      });

      placements[zoneType][slot] = draggedElement.dataset.id;
      zone.appendChild(draggedElement);
      attachDragEvents(draggedElement);

      checkFinalPassword();
      saveUserAttempt();
    });
  });

  allBanks.forEach(bank => {
    bank.addEventListener("dragover", e => e.preventDefault());

    bank.addEventListener("drop", () => {
      if (!draggedElement) return;

      const bankType = bank.dataset.type;
      if (bankType !== draggedType) return;

      ["image", "caption"].forEach(type => {
        placements[type] = placements[type].map(id =>
          id === draggedElement.dataset.id ? null : id
        );
      });

      bank.appendChild(draggedElement);
      attachDragEvents(draggedElement);

      checkFinalPassword();
      saveUserAttempt();
    });
  });

  const correctPairs = [
    { image: "E", caption: "3" },
    { image: "F", caption: "2" },
    { image: "C", caption: "4" },
    { image: "A", caption: "6" },
    { image: "D", caption: "1" },
    { image: "B", caption: "5" }
  ];

  document.querySelectorAll(".check-btn").forEach(button => {
    button.addEventListener("click", () => {
      const slot = +button.parentElement.dataset.slot;
      const imgId = placements.image[slot];
      const capId = placements.caption[slot];

      const isCorrect =
        imgId === correctPairs[slot].image &&
        capId === correctPairs[slot].caption;

      const resultIcon = document.createElement("span");
      resultIcon.classList.add("check-icon", isCorrect ? "correct" : "incorrect");
      resultIcon.textContent = isCorrect ? "✔" : "✖";

      button.replaceWith(resultIcon);

      if (isCorrect) {
        checks[slot] = true;
        const imageZone = document.querySelector(`.image-row .drop-zone[data-slot="${slot}"]`);
        const captionZone = document.querySelector(`.caption-row .drop-zone[data-slot="${slot}"]`);
        [imageZone, captionZone].forEach(zone => {
          zone.classList.add("locked");
          const item = zone.querySelector(".draggable");
          if (item) item.setAttribute("draggable", "false");
        });
        saveUserAttempt();
      } else {
        setTimeout(() => {
          resultIcon.replaceWith(button);
        }, 1500);
      }

      checkFinalPassword();
    });
  });

  function checkFinalPassword() {
    for (let i = 0; i < 6; i++) {
      if (
        placements.image[i] !== correctPairs[i].image ||
        placements.caption[i] !== correctPairs[i].caption
      ) {
        passwordField.value = "";
        return;
      }
    }

    passwordField.value = "reality";
    saveUserAttempt();
  }

  function saveUserAttempt() {
    const data = {
      images: placements.image,
      captions: placements.caption,
      checks: checks,
      timestamp: new Date().toISOString()
    };

    firebase.database().ref("attempts/" + currentSessionId).set(data)
      .then(() => console.log("Saved to Firebase for", currentSessionId))
      .catch((error) => console.error("Save error:", error));
  }

  function loadLatestUserAttempt() {
    const attemptRef = firebase.database().ref("attempts/" + currentSessionId);

    attemptRef.on("value", snapshot => {
      const data = snapshot.val();
      if (!data) return;

      const imagePlacements = data.images || {};
      const captionPlacements = data.captions || {};
      const checkStates = data.checks || [false, false, false, false, false, false];

      document.querySelectorAll(".drop-zone").forEach(zone => {
        while (zone.firstChild) zone.removeChild(zone.firstChild);
      });

      placements.image = [null, null, null, null, null, null];
      placements.caption = [null, null, null, null, null, null];

      Object.entries(imagePlacements).forEach(([slot, id]) => {
        const dropZone = document.querySelector(`.image-row .drop-zone[data-slot="${slot}"]`);
        if (dropZone) {
          const el = createDraggableElement(id, "image");
          dropZone.appendChild(el);
          placements.image[slot] = id;
          attachDragEvents(el);
        }
      });

      Object.entries(captionPlacements).forEach(([slot, id]) => {
        const dropZone = document.querySelector(`.caption-row .drop-zone[data-slot="${slot}"]`);
        if (dropZone) {
          const el = createDraggableElement(id, "caption");
          dropZone.appendChild(el);
          placements.caption[slot] = id;
          attachDragEvents(el);
        }
      });

      checkStates.forEach((locked, slot) => {
        if (locked) {
          checks[slot] = true;
          const imageZone = document.querySelector(`.image-row .drop-zone[data-slot="${slot}"]`);
          const captionZone = document.querySelector(`.caption-row .drop-zone[data-slot="${slot}"]`);
          const checkCell = document.querySelector(`.check-cell[data-slot="${slot}"]`);

          [imageZone, captionZone].forEach(zone => {
            if (zone) {
              zone.classList.add("locked");
              const item = zone.querySelector(".draggable");
              if (item) item.setAttribute("draggable", "false");
            }
          });

          if (checkCell && !checkCell.querySelector(".check-icon")) {
            const tick = document.createElement("span");
            tick.classList.add("check-icon", "correct");
            tick.textContent = "✔";
            checkCell.innerHTML = "";
            checkCell.appendChild(tick);
          }
        }
      });

      checkFinalPassword();
    });
  }

  function createDraggableElement(id, type) {
    const div = document.createElement("div");
    div.classList.add("draggable");
    div.setAttribute("draggable", "true");
    div.setAttribute("data-id", id);

    if (type === "image") {
      const img = document.createElement("img");
      img.src = `images/${id}.jpg`;
      div.appendChild(img);
    } else if (type === "caption") {
      const p = document.createElement("p");
      p.textContent = getCaptionTextById(id);
      div.appendChild(p);
    }

    return div;
  }

  function getCaptionTextById(id) {
    const captions = {
      "1": "After seeing the jailers, Alf ventures further out of the cave and spots an enormous exit. Again he is blinded but gradually, he recognizes the sun shining from the sky.",
      "2": "One prisoner, Alf, manages to leave captivity, Alf is blinded by a brilliant light. It hurts his eyes. But after a while Alf's eyes start to adjust.",
      "3": "There are prisoners kept locked up in a big cave, staring at the face of a wall. They are never allowed to turn and see what is behind them.",
      "4": "After seeing more clearly, Alf climbs up a ledge from where he looks down to where he spent most of his life. He sees a fire blocking the path of the prisoners.",
      "5": "Alf is excited and wants to tell everyone about the sun. The prisoners get really angry. They start shouting at Alf. 'Just go away!' they yell and throw rocks at him.",
      "6": "He also sees the jailers walk along the path carrying objects, the objects they carry cast shadows down on to the wall in front of the prisoners."
    };
    return captions[id] || "Unknown";
  }

  loadLatestUserAttempt();
});
