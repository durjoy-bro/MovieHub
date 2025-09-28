document.addEventListener('DOMContentLoaded', () => {
    // Firebase ইনিশিয়ালাইজেশন
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    // Firebase সার্ভিস রেফারেন্স
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();
    
    // --- DOM ELEMENT REFERENCES ---
    const appView = document.getElementById('app-view');
    const authView = document.getElementById('auth-view');
    const appHeader = document.getElementById('app-header');
    const mainContent = document.getElementById('main-content');
    const playerContainer = document.getElementById('player-container');
    const allNavItems = document.querySelectorAll('.nav-item');
    const bottomNav = document.querySelector('.bottom-nav');
    const selectionActionBar = document.getElementById('selection-action-bar');
    
    let allMovies = [], allNovels = [];
    let movieDataFetched = false, novelDataFetched = false;
    let isSelectionMode = false;

    // --- TEMPLATES (HTML structure stored in JS) ---
    const templates = {
        defaultHeader: `<h1 class="header-title">Moviez Hub</h1><div class="header-menu">&#8942;</div>`,
        downloadsHeader: `
            <h1 class="header-title">My Downloads</h1>
            <div class="header-menu" id="downloads-menu-btn">
                &#8942;
                <div id="downloads-dropdown-menu" class="dropdown-menu">
                    <a id="select-items-btn">Select items</a>
                </div>
            </div>`,
        selectionHeader: `<h1 class="header-title" id="selection-count">Select Items</h1><div class="header-menu" id="cancel-selection-btn">Cancel</div>`
    };

    // ইমেজ লোড করার ফাংশন - উন্নত সংস্করণ
    async function loadImageWithFallback(imageUrl, altText, element) {
        try {
            // Firebase Storage থেকে ইমেজ লোড করার চেষ্টা করুন
            if (imageUrl && imageUrl.startsWith('gs://')) {
                try {
                    const ref = storage.refFromURL(imageUrl);
                    const url = await ref.getDownloadURL();
                    element.src = url;
                    element.onerror = () => {
                        setFallbackImage(element, altText);
                    };
                    return;
                } catch (error) {
                    console.error('Error loading from Firebase Storage:', error);
                    setFallbackImage(element, altText);
                }
            } else if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('data:'))) {
                // সরাসরি URL বা base64 ডেটা
                element.src = imageUrl;
                element.onerror = () => {
                    setFallbackImage(element, altText);
                };
            } else {
                throw new Error('Invalid image URL provided');
            }
        } catch (error) {
            console.error('Error loading image:', error);
            setFallbackImage(element, altText);
        }
    }

    // ফলব্যাক ইমেজ সেট করার সহায়ক ফাংশন
    function setFallbackImage(element, altText) {
        element.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTMwIiBoZWlnaHQ9IjE4NSIgdmlld0JveD0iMCAwIDEzMCAxODUiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMzAiIGhlaWdodD0iMTg1IiByeD0iOCIgZmlsbD0iIzNENDM5OSIvPgo8dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSJib2xkIj5ObyBJbWFnZTwvdGV4dD4KPC9zdmc+';
        element.alt = altText + ' (Image not available)';
    }

    // --- VIEW & NAVIGATION MANAGEMENT ---
    function setActiveNav(buttonId) {
        allNavItems.forEach(item => item.classList.remove('active'));
        const activeBtn = document.getElementById(buttonId);
        if (activeBtn) activeBtn.classList.add('active');
    }

    // --- AUTHENTICATION LOGIC ---
    auth.onAuthStateChanged(user => {
        if (user) {
            appView.classList.add('active');
            authView.classList.remove('active');
            navigateTo('home');
        } else {
            authView.classList.add('active');
            appView.classList.remove('active');
            movieDataFetched = false; novelDataFetched = false;
            allMovies = []; allNovels = [];
        }
    });

    function attachAuthListeners() {
        document.getElementById('show-register-link')?.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(false); });
        document.getElementById('show-login-link')?.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(true); });
        document.getElementById('register-form')?.addEventListener('submit', handleAuthSubmit);
        document.getElementById('login-form')?.addEventListener('submit', handleAuthSubmit);
    }
    
    function toggleAuthForms(showLogin) {
        document.getElementById('login-form-container').style.display = showLogin ? 'block' : 'none';
        document.getElementById('register-form-container').style.display = showLogin ? 'none' : 'block';
    }

    function handleAuthSubmit(e) {
        e.preventDefault();
        const isLogin = e.target.id === 'login-form';
        const email = e.target.querySelector('input[type="email"]').value;
        const password = e.target.querySelector('input[type="password"]').value;
        const errorEl = document.getElementById(isLogin ? 'login-error' : 'register-error');
        errorEl.textContent = '';
        
        if (isLogin) {
            auth.signInWithEmailAndPassword(email, password).catch(err => errorEl.textContent = err.message);
        } else {
            auth.createUserWithEmailAndPassword(email, password)
                .then(userCredential => {
                    return db.collection('users').doc(userCredential.user.uid).set({
                        email: userCredential.user.email,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        isBlocked: false
                    });
                })
                .catch(err => errorEl.textContent = err.message);
        }
    }
    attachAuthListeners();

    // --- PAGE NAVIGATION LOGIC ---
    function navigateTo(pageName) {
        mainContent.innerHTML = '';
        setActiveNav(`${pageName}-btn`);
        if (isSelectionMode) exitSelectionMode();

        switch(pageName) {
            case 'home':
                appHeader.innerHTML = templates.defaultHeader;
                mainContent.innerHTML = `<div id="home-page" class="page-content active"><section class="search-section"><div class="filter-icon"><svg viewBox="0 0 24 24"><path fill="#34D399" d="M19.47 5.12a1 1 0 0 0-1-1.12H5.53a1 1 0 0 0-1 1.12l1.45 7.27a1 1 0 0 0 1 .81h8.04a1 1 0 0 0 1-.81zM6.35 15.42a1 1 0 0 0-.85.3A4.52 4.52 0 0 0 9 22a4.52 4.52 0 0 0 3.5-6.28a1 1 0 0 0-.85-.3z"/></svg></div><div class="search-bar"><svg class="search-icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5A6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14z"/></svg><input type="text" id="search-input" placeholder="Search movies"></div><button id="search-btn">Search</button></section><section class="categories-section"><h2>Categories</h2><div class="categories-list" id="categories-list"></div></section><div id="movie-shelves-container"></div></div>`;
                if (!movieDataFetched) fetchAndRenderHomeData(); else { renderCategories(); renderAllShelves(); attachSearchListener(); }
                break;
            case 'novelhub':
                appHeader.innerHTML = templates.defaultHeader;
                mainContent.innerHTML = `<div id="novelhub-page" class="page-content active placeholder-view"></div>`;
                if (!novelDataFetched) fetchAndRenderNovelData(); else renderNovelHubPage(allNovels);
                break;
            case 'downloads':
                appHeader.innerHTML = templates.downloadsHeader;
                mainContent.innerHTML = `<div id="downloads-page" class="page-content active placeholder-view"></div>`;
                renderDownloadsPage();
                break;
        }
    }
    
    // --- DATA FETCHING & RENDERING ---
    async function fetchAndRenderHomeData() {
        const shelvesContainer = document.getElementById('movie-shelves-container');
        shelvesContainer.innerHTML = '<h2>Loading movies...</h2>';
        try {
            const snapshot = await db.collection('movies').orderBy('createdAt', 'desc').get();
            allMovies = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, type: 'movie' }));
            movieDataFetched = true;
            renderCategories(); renderAllShelves(); attachSearchListener();
        } catch (error) { shelvesContainer.innerHTML = `<p>Error loading movies.</p>`; }
    }
    
    async function fetchAndRenderNovelData() {
        const novelPage = document.getElementById('novelhub-page');
        novelPage.innerHTML = '<h2>Loading novels...</h2>';
        try {
            const snapshot = await db.collection('novels').orderBy('createdAt', 'desc').get();
            allNovels = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, type: 'novel' }));
            novelDataFetched = true;
            renderNovelHubPage(allNovels);
        } catch (error) { novelPage.innerHTML = `<p>Error loading novels.</p>`; }
    }
    
    // ক্যাটেগরি রেন্ডার করার ফাংশন
    function renderCategories() {
        const categoriesList = document.getElementById('categories-list');
        if (!categoriesList) return;
        
        // সমস্ত মুভি থেকে ইউনিক ক্যাটেগরি বের করুন
        const allCategories = [...new Set(allMovies.flatMap(movie => 
            movie.genre ? movie.genre.split(',').map(g => g.trim()) : []
        ))];
        
        // "All" ক্যাটেগরি যোগ করুন
        const categories = ['All', ...allCategories];
        
        categoriesList.innerHTML = categories.map(category => 
            `<button class="category-btn" data-category="${category}">${category}</button>`
        ).join('');
        
        // প্রথম ক্যাটেগরি অ্যাক্টিভ করুন
        if (categoriesList.firstChild) {
            categoriesList.firstChild.classList.add('active');
        }
        
        // ক্যাটেগরি বাটনে ক্লিক ইভেন্ট যোগ করুন
        categoriesList.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                categoriesList.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                filterMoviesByCategory(btn.dataset.category);
            });
        });
    }
    
    // ক্যাটেগরি অনুযায়ী মুভি ফিল্টার করার ফাংশন
    function filterMoviesByCategory(category) {
        let filteredMovies = allMovies;
        if (category !== 'All') {
            filteredMovies = allMovies.filter(movie => 
                movie.genre && movie.genre.includes(category)
            );
        }
        
        const shelvesContainer = document.getElementById('movie-shelves-container');
        shelvesContainer.innerHTML = `
            <div class="movie-shelf">
                <div class="shelf-header">
                    <h2>${category === 'All' ? 'All Movies' : category}</h2>
                </div>
                <div class="movie-row">
                    ${filteredMovies.map(movie => createMovieCardHTML(movie)).join('')}
                </div>
            </div>
        `;
        
        // ইমেজ লোড করুন
        shelvesContainer.querySelectorAll('.movie-card img').forEach(img => {
            if (img.dataset.src) {
                loadImageWithFallback(img.dataset.src, img.alt, img);
            }
        });
        
        // ক্লিক ইভেন্ট যোগ করুন
        shelvesContainer.querySelectorAll('.movie-card').forEach(card => {
            card.addEventListener('click', () => showPlayer(card.dataset.itemId, 'movie'));
        });
    }
    
    // সমস্ত শেল্ফ রেন্ডার করার ফাংশন
    function renderAllShelves() {
        const shelvesContainer = document.getElementById('movie-shelves-container');
        if (!shelvesContainer) return;
        
        // ক্যাটেগরি অনুযায়ী গ্রুপ করুন
        const categories = [...new Set(allMovies.flatMap(movie => 
            movie.genre ? movie.genre.split(',').map(g => g.trim()) : []
        ))];
        
        // প্রতিটি ক্যাটেগরির জন্য একটি শেল্ফ তৈরি করুন
        let shelvesHTML = '';
        
        // প্রথমে "Latest Movies" শেল্ফ যোগ করুন
        const latestMovies = allMovies.slice(0, 10);
        shelvesHTML += `
            <div class="movie-shelf">
                <div class="shelf-header">
                    <h2>Latest Movies</h2>
                </div>
                <div class="movie-row">
                    ${latestMovies.map(movie => createMovieCardHTML(movie)).join('')}
                </div>
            </div>
        `;
        
        // তারপর প্রতিটি ক্যাটেগরির জন্য শেল্ফ যোগ করুন
        categories.forEach(category => {
            const categoryMovies = allMovies.filter(movie => 
                movie.genre && movie.genre.includes(category)
            );
            
            if (categoryMovies.length > 0) {
                shelvesHTML += `
                    <div class="movie-shelf">
                        <div class="shelf-header">
                            <h2>${category}</h2>
                        </div>
                        <div class="movie-row">
                            ${categoryMovies.map(movie => createMovieCardHTML(movie)).join('')}
                        </div>
                    </div>
                `;
            }
        });
        
        shelvesContainer.innerHTML = shelvesHTML;
        
        // ইমেজ লোড করুন
        shelvesContainer.querySelectorAll('.movie-card img').forEach(img => {
            if (img.dataset.src) {
                loadImageWithFallback(img.dataset.src, img.alt, img);
            }
        });
        
        // ক্লিক ইভেন্ট যোগ করুন
        shelvesContainer.querySelectorAll('.movie-card').forEach(card => {
            card.addEventListener('click', () => showPlayer(card.dataset.itemId, 'movie'));
        });
    }
    
    // মুভি কার্ড HTML তৈরি করার ফাংশন
    function createMovieCardHTML(movie) {
        return `
            <div class="movie-card" data-item-id="${movie.id}">
                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTMwIiBoZWlnaHQ9IjE4NSIgdmlld0JveD0iMCAwIDEzMCAxODUiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMzAiIGhlaWdodD0iMTg1IiByeD0iOCIgZmlsbD0iIzNENDM5OSIvPgo8dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSJib2xkIj5Mb2FkaW5nLi4uPC90ZXh0Pgo8L3N2Zz4=" 
                     alt="${movie.title}" 
                     data-src="${movie.posterUrl}">
                <p>${movie.title}</p>
            </div>
        `;
    }
    
    function renderNovelHubPage(novels) {
        const novelPage = document.getElementById('novelhub-page');
        if (novels.length === 0) { 
            novelPage.innerHTML = '<h2>Novel Hub</h2><p>No novels available yet.</p>'; 
            return; 
        }
        
        let cardsHTML = novels.map(novel => `
            <div class="novel-card" data-item-id="${novel.id}">
                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTMwIiBoZWlnaHQ9IjE4NSIgdmlld0JveD0iMCAwIDEzMCAxODUiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMzAiIGhlaWdodD0iMTg1IiByeD0iOCIgZmlsbD0iIzNENDM5OSIvPgo8dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSJib2xkIj5Mb2FkaW5nLi4uPC90ZXh0Pgo8L3N2Zz4=" 
                     alt="${novel.title}" 
                     data-src="${novel.coverUrl}">
                <p>${novel.title}</p>
                <p class="author">${novel.author}</p>
            </div>
        `).join('');
        
        novelPage.innerHTML = `
            <h2>Novel Hub</h2>
            <div class="novel-grid">${cardsHTML}</div>
        `;
        
        // ইমেজ লোড করুন
        novelPage.querySelectorAll('.novel-card img').forEach(img => {
            if (img.dataset.src) {
                loadImageWithFallback(img.dataset.src, img.alt, img);
            }
        });
        
        novelPage.querySelectorAll('.novel-card').forEach(card => {
            card.addEventListener('click', () => showPlayer(card.dataset.itemId, 'novel'));
        });
    }

    function renderDownloadsPage() {
        const downloadsPage = document.getElementById('downloads-page');
        const downloads = JSON.parse(localStorage.getItem('downloads')) || [];
        
        if (downloads.length === 0) { 
            downloadsPage.innerHTML = '<h2 class="placeholder-view">My Downloads</h2><p>You have no saved items.</p>'; 
            return; 
        }
        
        let itemsHTML = downloads.map((item, index) => `
            <div class="download-item" data-index="${index}">
                <div class="download-item-left">
                    <input type="checkbox" class="download-checkbox">
                    <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iODUiIHZpZXdCb3g9IjAgMCA2MCA4NSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9Ijg1IiByeD0iNCIgZmlsbD0iIzNENDM5OSIvPgo8dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMTIiIGZvbnQtd2VpZ2h0PSJib2xkIj5Mb2FkaW5nLi4uPC90ZXh0Pgo8L3N2Zz4=" 
                         alt="${item.title}" 
                         data-src="${item.posterUrl || item.coverUrl}">
                    <div class="download-item-info">
                        <p>${item.title}</p>
                    </div>
                </div>
            </div>
        `).join('');
        
        downloadsPage.innerHTML = `<div class="download-list">${itemsHTML}</div>`;
        
        // ইমেজ লোড করুন
        downloadsPage.querySelectorAll('.download-item img').forEach(img => {
            if (img.dataset.src) {
                loadImageWithFallback(img.dataset.src, img.alt, img);
            }
        });
        
        attachDownloadMenuListeners();
    }
    
    // --- DOWNLOADS PAGE ACTIONS ---
    function attachDownloadMenuListeners() {
        const menuBtn = document.getElementById('downloads-menu-btn');
        const dropdown = document.getElementById('downloads-dropdown-menu');
        menuBtn?.addEventListener('click', e => {
            e.stopPropagation();
            dropdown.classList.toggle('visible');
        });
        document.getElementById('select-items-btn')?.addEventListener('click', e => {
            e.preventDefault();
            dropdown.classList.remove('visible');
            enterSelectionMode();
        });
    }

    function enterSelectionMode() {
        isSelectionMode = true;
        appHeader.innerHTML = templates.selectionHeader;
        bottomNav.classList.add('hidden');
        selectionActionBar.classList.add('visible');
        document.querySelectorAll('.download-item').forEach(item => item.classList.add('selection-mode'));
        updateSelectionCount();
        document.getElementById('cancel-selection-btn').addEventListener('click', exitSelectionMode);
        document.querySelectorAll('.download-checkbox').forEach(cb => cb.addEventListener('change', updateSelectionCount));
        document.getElementById('delete-selected-btn').addEventListener('click', deleteSelectedItems);
    }

    function exitSelectionMode() {
        isSelectionMode = false;
        appHeader.innerHTML = templates.downloadsHeader;
        attachDownloadMenuListeners();
        bottomNav.classList.remove('hidden');
        selectionActionBar.classList.remove('visible');
        document.querySelectorAll('.download-item').forEach(item => {
            item.classList.remove('selection-mode');
            item.querySelector('.download-checkbox').checked = false;
        });
    }
    
    function updateSelectionCount() {
        const selectedCount = document.querySelectorAll('.download-checkbox:checked').length;
        document.getElementById('selection-count').textContent = `${selectedCount} selected`;
    }

    function deleteSelectedItems() {
        let downloads = JSON.parse(localStorage.getItem('downloads')) || [];
        const checkedIndexes = Array.from(document.querySelectorAll('.download-checkbox:checked')).map(cb => parseInt(cb.closest('.download-item').dataset.index));
        if (checkedIndexes.length === 0) { alert('Please select items to delete.'); return; }
        const updatedDownloads = downloads.filter((_, index) => !checkedIndexes.includes(index));
        localStorage.setItem('downloads', JSON.stringify(updatedDownloads));
        exitSelectionMode();
        renderDownloadsPage();
    }
    window.addEventListener('click', () => document.getElementById('downloads-dropdown-menu')?.classList.remove('visible'));

    // --- SEARCH FUNCTIONALITY ---
    function attachSearchListener() {
        document.getElementById('search-btn')?.addEventListener('click', () => {
            const query = document.getElementById('search-input').value.trim().toLowerCase();
            if (!query) return;
            const filteredMovies = allMovies.filter(movie => movie.title.toLowerCase().includes(query));
            mainContent.innerHTML = `<div id="search-results-page" class="page-content active"><h2>Search Results for "${query}"</h2><div class="movie-row">${filteredMovies.length > 0 ? filteredMovies.map(movie => createMovieCardHTML(movie)).join('') : '<p>No movies found.</p>'}</div></div>`;
            document.querySelectorAll('.movie-card img').forEach(img => {
                if (img.dataset.src) {
                    loadImageWithFallback(img.dataset.src, img.alt, img);
                }
            });
            document.querySelectorAll('.movie-card').forEach(card => {
                card.addEventListener('click', () => showPlayer(card.dataset.itemId, 'movie'));
            });
        });
    }

    // --- PLAYER FUNCTIONALITY ---
    async function showPlayer(itemId, type) {
        let item;
        if (type === 'movie') {
            item = allMovies.find(m => m.id === itemId);
        } else {
            if (!novelDataFetched) await fetchAndRenderNovelData();
            item = allNovels.find(n => n.id === itemId);
        }
        if (!item) return;
        
        playerContainer.innerHTML = `
            <div class="player-header">
                <button id="close-player-btn">✕</button>
                <h2>${type === 'movie' ? 'Movie Details' : 'Novel Details'}</h2>
            </div>
            <div class="player-content">
                <div class="player-poster">
                    <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI4MCIgdmlld0JveD0iMCAwIDIwMCAyODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjgwIiByeD0iOCIgZmlsbD0iIzNENDM5OSIvPgo8dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSJib2xkIj5Mb2FkaW5nLi4uPC90ZXh0Pgo8L3N2Zz4=" 
                         alt="${item.title}" 
                         data-src="${item.posterUrl || item.coverUrl}">
                </div>
                <div class="player-details">
                    <h1>${item.title}</h1>
                    ${item.year ? `<p>Year: ${item.year}</p>` : ''}
                    ${item.genre ? `<p>Genre: ${item.genre}</p>` : ''}
                    ${item.author ? `<p>Author: ${item.author}</p>` : ''}
                    ${item.description ? `<p class="description">${item.description}</p>` : ''}
                    ${item.downloadUrl ? `<a href="${item.downloadUrl}" class="download-btn" target="_blank">Download</a>` : ''}
                    <button class="save-btn" data-item-id="${item.id}" data-type="${type}">Save to Downloads</button>
                </div>
            </div>
        `;
        
        // ইমেজ লোড করুন
        const posterImg = playerContainer.querySelector('.player-poster img');
        if (posterImg.dataset.src) {
            loadImageWithFallback(posterImg.dataset.src, posterImg.alt, posterImg);
        }
        
        playerContainer.classList.add('visible');
        document.getElementById('close-player-btn').addEventListener('click', () => playerContainer.classList.remove('visible'));
        document.querySelector('.save-btn').addEventListener('click', saveToDownloads);
    }
    
    function saveToDownloads(e) {
        const itemId = e.target.dataset.itemId;
        const type = e.target.dataset.type;
        let item;
        if (type === 'movie') {
            item = allMovies.find(m => m.id === itemId);
        } else {
            item = allNovels.find(n => n.id === itemId);
        }
        if (!item) return;
        
        const downloads = JSON.parse(localStorage.getItem('downloads')) || [];
        const alreadyExists = downloads.some(d => d.id === item.id && d.type === type);
        if (alreadyExists) {
            alert('This item is already in your downloads.');
            return;
        }
        downloads.push({ ...item, type });
        localStorage.setItem('downloads', JSON.stringify(downloads));
        alert('Item saved to downloads!');
    }

    // --- BOTTOM NAVIGATION EVENT LISTENERS ---
    document.getElementById('home-btn').addEventListener('click', e => { e.preventDefault(); navigateTo('home'); });
    document.getElementById('novelhub-btn').addEventListener('click', e => { e.preventDefault(); navigateTo('novelhub'); });
    document.getElementById('central-btn').addEventListener('click', e => { e.preventDefault(); alert('Central button clicked!'); });
    document.getElementById('downloads-btn').addEventListener('click', e => { e.preventDefault(); navigateTo('downloads'); });
    document.getElementById('me-btn').addEventListener('click', e => { e.preventDefault(); alert('Me section coming soon!'); });
});