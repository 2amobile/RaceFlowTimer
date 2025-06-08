document.addEventListener('DOMContentLoaded', () => {
    const sessionForm = document.getElementById('sessionForm');
    const sessionDayInput = document.getElementById('sessionDay');
    const categoryInput = document.getElementById('category');
    const sessionTypeInput = document.getElementById('sessionType');
    const startTimeInput = document.getElementById('startTime');
    const durationInput = document.getElementById('duration');
    const addSessionBtn = document.getElementById('addSessionBtn');
    const clearFormBtn = document.getElementById('clearFormBtn');
    const sessionsListAdmin = document.getElementById('sessionsListAdmin');
    const clearAllSessionsBtn = document.getElementById('clearAllSessionsBtn');

    const scheduleNameInput = document.getElementById('scheduleName');
    const preSessionWarningTimeInput = document.getElementById('preSessionWarningTime');
    const preSessionWarningTimeLabel = document.getElementById('preSessionWarningTimeLabel');
    const mainTimerSizeInput = document.getElementById('mainTimerSize');
    const mainTimerSizeLabel = document.getElementById('mainTimerSizeLabel');
    const titleSizeInput = document.getElementById('titleSize');
    const titleSizeLabel = document.getElementById('titleSizeLabel');
    const secondaryTimerSizeInput = document.getElementById('secondaryTimerSize');
    const secondaryTimerSizeLabel = document.getElementById('secondaryTimerSizeLabel');
    
    const saveScheduleBtn = document.getElementById('saveSchedule');
    const loadScheduleSelect = document.getElementById('loadScheduleSelect');
    const loadScheduleBtn = document.getElementById('loadScheduleBtn');
    const deleteScheduleBtn = document.getElementById('deleteScheduleBtn');
    const launchDisplayBtn = document.getElementById('launchDisplayBtn');

    const categorySuggestions = document.getElementById('categorySuggestions');
    const sessionTypeSuggestions = document.getElementById('sessionTypeSuggestions');
    
    const settingsModal = document.getElementById('settingsModal');
    const openSettingsModalBtn = document.getElementById('openSettingsModalBtn');
    const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
    const closeModalAndSaveBtn = document.getElementById('closeModalAndSaveBtn');


    let sessions = [];
    let editingSessionId = null;
    const LOCAL_STORAGE_PREFIX = 'race_schedule_';
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

    openSettingsModalBtn.addEventListener('click', () => {
        settingsModal.style.display = 'flex';
    });

    const closeModal = () => {
        settingsModal.style.display = 'none';
    };

    closeSettingsModalBtn.addEventListener('click', closeModal);
    closeModalAndSaveBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (event) => {
        if (event.target == settingsModal) {
            closeModal();
        }
    });

    preSessionWarningTimeInput.addEventListener('input', (e) => preSessionWarningTimeLabel.textContent = e.target.value);
    mainTimerSizeInput.addEventListener('input', (e) => mainTimerSizeLabel.textContent = e.target.value);
    titleSizeInput.addEventListener('input', (e) => titleSizeLabel.textContent = e.target.value);
    secondaryTimerSizeInput.addEventListener('input', (e) => secondaryTimerSizeLabel.textContent = e.target.value);

    function formatTimeForStorage(timeStr) { 
        return timeStr; 
    }
    
    function generateId() {
        return '_' + Math.random().toString(36).substr(2, 9);
    }

    function checkSessionOverlap(newSessionDetails, existingSessions, currentEditingId) {
        const newDay = parseInt(newSessionDetails.dayOfWeek);
        const [newStartH, newStartM] = newSessionDetails.time.split(':').map(Number);
        const newStartTimeInMinutes = (newStartH * 60) + newStartM;
        const newEndTimeInMinutes = newStartTimeInMinutes + parseInt(newSessionDetails.duration);

        for (const existingSession of existingSessions) {
            if (currentEditingId && existingSession.id === currentEditingId) {
                continue;
            }

            if (parseInt(existingSession.dayOfWeek) === newDay) {
                const [existingStartH, existingStartM] = existingSession.time.split(':').map(Number);
                const existingStartTimeInMinutes = (existingStartH * 60) + existingStartM;
                const existingEndTimeInMinutes = existingStartTimeInMinutes + parseInt(existingSession.duration);

                if (newStartTimeInMinutes < existingEndTimeInMinutes && newEndTimeInMinutes > existingStartTimeInMinutes) {
                    return true; 
                }
            }
        }
        return false; 
    }


    function renderAdminList() {
        sessionsListAdmin.innerHTML = '';
        const sortedSessions = [...sessions].sort((a, b) => {
            if (parseInt(a.dayOfWeek) !== parseInt(b.dayOfWeek)) {
                return parseInt(a.dayOfWeek) - parseInt(b.dayOfWeek);
            }
            return a.time.localeCompare(b.time);
        });

        if (sortedSessions.length === 0) {
            sessionsListAdmin.innerHTML = '<li class="empty-state">Aucune séance programmée. Ajoutez-en une !</li>';
        } else {
            sortedSessions.forEach(session => {
                const li = document.createElement('li');
                li.dataset.id = session.id;
                li.innerHTML = `
                    <div class="session-info">
                        <span class="session-day-badge">${dayNames[session.dayOfWeek]}</span>
                        <strong>${session.time}</strong> (${session.duration} min) - 
                        ${session.category} - ${session.sessionType}
                    </div>
                    <div class="session-actions">
                        <button class="edit-btn" title="Modifier"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn" title="Supprimer"><i class="fas fa-trash-alt"></i></button>
                    </div>
                `;
                sessionsListAdmin.appendChild(li);
            });
        }
        updateSuggestions();
    }

    function updateSuggestions() {
        const uniqueCategories = [...new Set(sessions.map(s => s.category))];
        const uniqueSessionTypes = [...new Set(sessions.map(s => s.sessionType))];
        categorySuggestions.innerHTML = uniqueCategories.map(c => `<option value="${c}"></option>`).join('');
        sessionTypeSuggestions.innerHTML = uniqueSessionTypes.map(st => `<option value="${st}"></option>`).join('');
    }

    sessionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const dayOfWeek = parseInt(sessionDayInput.value);
        const category = categoryInput.value.trim();
        const sessionType = sessionTypeInput.value.trim();
        const time = formatTimeForStorage(startTimeInput.value); 
        const duration = parseInt(durationInput.value);

        if (isNaN(dayOfWeek) || !category || !sessionType || !time || !duration || duration <= 0) {
            alert('Veuillez remplir tous les champs correctement (durée > 0).'); return;
        }

        const sessionCandidateDetails = { dayOfWeek, time, duration };
        
        if (checkSessionOverlap(sessionCandidateDetails, sessions, editingSessionId)) {
            alert("Erreur : Conflit d'horaire ! Cette séance se chevauche avec une autre séance existante le même jour.");
            return; 
        }

        if (editingSessionId) {
            const index = sessions.findIndex(s => s.id === editingSessionId);
            if (index > -1) {
                sessions[index] = { 
                    ...sessions[index],
                    dayOfWeek, 
                    category, 
                    sessionType, 
                    time, 
                    duration 
                };
            }
            editingSessionId = null;
            addSessionBtn.innerHTML = '<i class="fas fa-check icon"></i> Ajouter/Valider';
        } else {
            sessions.push({ 
                id: generateId(), 
                dayOfWeek, 
                category, 
                sessionType, 
                time, 
                duration 
            });
        }
        
        categoryInput.value = '';
        sessionTypeInput.value = '';
        startTimeInput.value = '';
        durationInput.value = '';
        
        categoryInput.focus();
        renderAdminList();
    });

    clearFormBtn.addEventListener('click', () => {
        sessionForm.reset();
        const today = new Date().getDay(); 
        sessionDayInput.value = today; 
        editingSessionId = null;
        addSessionBtn.innerHTML = '<i class="fas fa-check icon"></i> Ajouter/Valider';
        categoryInput.focus();
    });

    sessionsListAdmin.addEventListener('click', (e) => {
        const targetButton = e.target.closest('button');
        if (!targetButton) return;
        const li = targetButton.closest('li[data-id]');
        if (!li) return;
        const sessionId = li.dataset.id;

        if (targetButton.classList.contains('edit-btn')) {
            const session = sessions.find(s => s.id === sessionId);
            if (session) {
                sessionDayInput.value = session.dayOfWeek;
                categoryInput.value = session.category;
                sessionTypeInput.value = session.sessionType;
                startTimeInput.value = session.time; 
                durationInput.value = session.duration;
                editingSessionId = session.id; 
                addSessionBtn.innerHTML = '<i class="fas fa-check icon"></i> Modifier Séance';
                categoryInput.focus();
            }
        } else if (targetButton.classList.contains('delete-btn')) {
            if (confirm('Supprimer cette séance ?')) {
                sessions = sessions.filter(s => s.id !== sessionId);
                renderAdminList();
            }
        }
    });

    clearAllSessionsBtn.addEventListener('click', () => {
        if (confirm('Voulez-vous vraiment effacer toutes les séances du planning actuel (non sauvegardé) ?')) {
            sessions = [];
            renderAdminList();
            sessionForm.reset();
            const today = new Date().getDay(); 
            sessionDayInput.value = today;
            editingSessionId = null;
            addSessionBtn.innerHTML = '<i class="fas fa-check icon"></i> Ajouter/Valider';
        }
    });

    function populateLoadScheduleDropdown() {
        loadScheduleSelect.innerHTML = '<option value="">Sélectionnez un planning...</option>';
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(LOCAL_STORAGE_PREFIX)) {
                const scheduleName = key.substring(LOCAL_STORAGE_PREFIX.length);
                const option = document.createElement('option');
                option.value = scheduleName;
                option.textContent = scheduleName;
                loadScheduleSelect.appendChild(option);
            }
        }
    }

    saveScheduleBtn.addEventListener('click', () => {
        const name = scheduleNameInput.value.trim();
        if (!name) {
            alert('Veuillez donner un nom au planning.'); scheduleNameInput.focus(); return;
        }
        
        const scheduleData = {
            sessions: sessions, 
            settings: {
                preSessionWarningMinutes: parseInt(preSessionWarningTimeInput.value) || 15,
                mainTimerSize: parseFloat(mainTimerSizeInput.value) || 100,
                titleSize: parseFloat(titleSizeInput.value) || 100,
                secondaryTimerSize: parseFloat(secondaryTimerSizeInput.value) || 100
            }
        };

        try {
            localStorage.setItem(LOCAL_STORAGE_PREFIX + name, JSON.stringify(scheduleData));
            alert(`Planning '${name}' sauvegardé localement.`);
            populateLoadScheduleDropdown();
             if(loadScheduleSelect.value !== name) {
                loadScheduleSelect.value = name;
            }
        } catch (error) {
            console.error("Erreur de sauvegarde:", error);
            alert('Erreur lors de la sauvegarde. Stockage local plein ou données non sérialisables ?');
        }
    });

    loadScheduleBtn.addEventListener('click', () => {
        const name = loadScheduleSelect.value;
        if (!name) {
            alert('Veuillez sélectionner un planning à charger.'); return;
        }
        const savedScheduleJSON = localStorage.getItem(LOCAL_STORAGE_PREFIX + name);
        if (savedScheduleJSON) {
            try {
                const loadedData = JSON.parse(savedScheduleJSON);
                
                if (loadedData.sessions && loadedData.settings) { 
                    sessions = loadedData.sessions;
                    preSessionWarningTimeInput.value = loadedData.settings.preSessionWarningMinutes || 15;
                    mainTimerSizeInput.value = loadedData.settings.mainTimerSize || 100;
                    titleSizeInput.value = loadedData.settings.titleSize || 100;
                    secondaryTimerSizeInput.value = loadedData.settings.secondaryTimerSize || 100;
                } else { 
                    sessions = loadedData; 
                    preSessionWarningTimeInput.value = 15;
                    mainTimerSizeInput.value = 100;
                    titleSizeInput.value = 100;
                    secondaryTimerSizeInput.value = 100;
                }
                
                preSessionWarningTimeLabel.textContent = preSessionWarningTimeInput.value;
                mainTimerSizeLabel.textContent = mainTimerSizeInput.value;
                titleSizeLabel.textContent = titleSizeInput.value;
                secondaryTimerSizeLabel.textContent = secondaryTimerSizeInput.value;

                renderAdminList();
                scheduleNameInput.value = name;
                alert(`Planning '${name}' chargé.`);
            } catch (error) {
                console.error("Erreur de chargement:", error);
                alert('Erreur lors du chargement (données corrompues ?).');
            }
        } else {
            alert('Planning non trouvé.');
        }
    });

    deleteScheduleBtn.addEventListener('click', () => {
        const name = scheduleNameInput.value.trim(); 
        if (!name) {
            alert('Aucun planning actif à supprimer (vérifiez le nom du planning).'); return;
        }
        if (!localStorage.getItem(LOCAL_STORAGE_PREFIX + name)){
            alert(`Le planning nommé '${name}' n'existe pas dans le stockage.`); return;
        }

        if (confirm(`Voulez-vous vraiment supprimer le planning '${name}' ?`)) {
            localStorage.removeItem(LOCAL_STORAGE_PREFIX + name);
            alert(`Planning '${name}' supprimé.`);
            populateLoadScheduleDropdown();
            if (scheduleNameInput.value === name) { 
                scheduleNameInput.value = '';
                sessions = []; 
                preSessionWarningTimeInput.value = 15;
                renderAdminList();
            }
        }
    });

    launchDisplayBtn.addEventListener('click', () => {
        const name = scheduleNameInput.value.trim();
        if (!name) {
            alert("Veuillez d'abord nommer et sauvegarder le planning actuel, ou charger un planning existant.");
            scheduleNameInput.focus();
            return;
        }
        if (!localStorage.getItem(LOCAL_STORAGE_PREFIX + name)) {
             if (sessions.length > 0 || parseInt(preSessionWarningTimeInput.value) !== 15) { 
                if (confirm(`Le planning nommé '${name}' (avec les paramètres actuels) n'est pas sauvegardé. Sauvegarder maintenant avant de lancer l'affichage?`)) {
                    saveScheduleBtn.click(); 
                     if (!localStorage.getItem(LOCAL_STORAGE_PREFIX + name)) {
                        alert("La sauvegarde a échoué. Impossible de lancer l'affichage."); return;
                     }
                } else {
                    alert("Veuillez sauvegarder le planning sous le nom affiché avant de lancer l'affichage."); return;
                }
            } else { 
                 alert("Aucune session dans le planning actuel et le planning n'est pas sauvegardé. Impossible de lancer l'affichage."); return;
            }
        }
        window.open(`display.html?schedule=${encodeURIComponent(name)}`, '_blank');
    });

    function initAdmin() {
        renderAdminList();
        populateLoadScheduleDropdown();
        const today = new Date().getDay(); 
        sessionDayInput.value = today; 
        preSessionWarningTimeInput.value = 15; 
        mainTimerSizeInput.value = 100;
        titleSizeInput.value = 100;
        secondaryTimerSizeInput.value = 100;
        preSessionWarningTimeLabel.textContent = preSessionWarningTimeInput.value;
        mainTimerSizeLabel.textContent = mainTimerSizeInput.value;
        titleSizeLabel.textContent = titleSizeInput.value;
        secondaryTimerSizeLabel.textContent = secondaryTimerSizeInput.value;
    }
    initAdmin();
});