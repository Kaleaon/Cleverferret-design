const grid = document.querySelector('#cardGrid');
const cards = () => [...grid.querySelectorAll('.content-card')];
const filters = [...document.querySelectorAll('.filter')];
const searchInput = document.querySelector('#searchInput');
const resultCount = document.querySelector('#resultCount');
const emptyState = document.querySelector('#emptyState');
let activeFilter = 'all';

function updateResults() {
  const query = searchInput.value.trim().toLowerCase();
  let visible = 0;
  cards().forEach((card) => {
    const matchesFilter = activeFilter === 'all' || card.dataset.type === activeFilter;
    const matchesSearch = !query || card.dataset.search.includes(query) || card.textContent.toLowerCase().includes(query);
    const show = matchesFilter && matchesSearch;
    card.hidden = !show;
    if (show) visible += 1;
  });
  resultCount.textContent = `${visible} ${visible === 1 ? 'item' : 'items'}`;
  emptyState.style.display = visible ? 'none' : 'block';
}

filters.forEach((button) => button.addEventListener('click', () => {
  filters.forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  activeFilter = button.dataset.filter;
  updateResults();
}));
searchInput.addEventListener('input', updateResults);

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === 'Escape') closeSidebar();
});

document.querySelectorAll('.view-controls button').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.view-controls button').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  grid.classList.toggle('list-view', button.dataset.view === 'list');
}));

grid.addEventListener('click', (event) => {
  const star = event.target.closest('.star-button');
  if (!star) return;
  star.classList.toggle('active');
  const isActive = star.classList.contains('active');
  star.setAttribute('aria-label', isActive ? 'Remove from favorites' : 'Add to favorites');
  showToast(isActive ? 'Added to favorites' : 'Removed from favorites');
});

const sidebar = document.querySelector('#sidebar');
const scrim = document.querySelector('#scrim');
document.querySelector('#menuButton').addEventListener('click', () => {
  sidebar.classList.add('open');
  scrim.classList.add('show');
});
scrim.addEventListener('click', closeSidebar);
function closeSidebar() {
  sidebar.classList.remove('open');
  scrim.classList.remove('show');
}

const dialog = document.querySelector('#addDialog');
document.querySelector('#addButton').addEventListener('click', () => dialog.showModal());
document.querySelector('#closeDialog').addEventListener('click', () => dialog.close());
document.querySelector('#cancelDialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

document.querySelector('#addForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const title = document.querySelector('#newTitle').value.trim();
  const type = document.querySelector('#newType').value;
  const link = document.querySelector('#newLink').value;
  if (!title || !link) return;
  const card = document.createElement('article');
  card.className = 'content-card';
  card.dataset.type = type;
  card.dataset.search = `${title} ${type} newly saved` .toLowerCase();
  card.innerHTML = `<div class="card-visual visual-green"><span class="leaf leaf-1"></span><span class="leaf leaf-2"></span><span class="type-pill">${type[0].toUpperCase() + type.slice(1)}</span></div><div class="card-body"><div class="source"><span class="source-icon green">N</span>Newly saved<span>· Just now</span></div><h3></h3><p>A new reference ready to organize, revisit, and share.</p><div class="card-bottom"><div class="tags"><span>New</span><span>${type}</span></div><button class="star-button" aria-label="Add to favorites"><svg><use href="#i-star"/></svg></button></div></div>`;
  card.querySelector('h3').textContent = title;
  grid.prepend(card);
  activeFilter = 'all';
  filters.forEach((item) => item.classList.toggle('active', item.dataset.filter === 'all'));
  searchInput.value = '';
  updateResults();
  event.target.reset();
  dialog.close();
  showToast('Saved to your library');
});

let toastTimer;
function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
