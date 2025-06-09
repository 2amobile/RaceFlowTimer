document.addEventListener('DOMContentLoaded', () => {
    // Éléments DOM
    const sessionForm = document.getElementById('sessionForm');
    const sessionDayInput = document.getElementById('sessionDay');
    const isMechanicSessionCheckbox = document.getElementById('isMechanicSession');
    const categoryFormGroup = document.getElementById('category-form-group');
    const categoryInput = document.getElementById('category');
    const sessionTypeInput = document.getElementById('sessionType');
    const startTimeInput = document.getElementById('startTime');
    const durationInput = document.getElementById('duration');
    const addSessionBtn = document.getElementById('addSessionBtn');
    const clearFormBtn = document.getElementById('clearFormBtn');
    const sessionsListAdmin = document.getElementById('sessionsListAdmin');
    const clearAllSessionsBtn = document.getElementById('clearAllSessionsBtn');

    const scheduleNameInput = document.getElementById('scheduleName');
    const saveScheduleBtn = document.getElementById('saveSchedule');
    const loadScheduleSelect = document.getElementById('loadScheduleSelect');
    const loadScheduleBtn = document.getElementById('loadScheduleBtn');
    const deleteScheduleBtn = document.getElementById('deleteScheduleBtn');
    const launchDisplayBtn = document.getElementById('launchDisplayBtn');
    const launchMechanicDisplayBtn = document.getElementById('launchMechanicDisplayBtn');

    const settingsModal = document.getElementById('settingsModal');
    const openSettingsModalBtn = document.getElementById('openSettingsModalBtn');
    const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
    const closeModalAndSaveBtn = document.getElementById('closeModalAndSaveBtn');
    
    const preSessionWarningTimeInput = document.getElementById('preSessionWarningTime');
    const preSessionWarningTimeLabel = document.getElementById('preSessionWarningTimeLabel');
    const mainTimerSizeInput = document.getElementById('mainTimerSize');
    const mainTimerSizeLabel = document.getElementById('mainTimerSizeLabel');
    const titleSizeInput = document.getElementById('titleSize');
    const titleSizeLabel = document.getElementById('titleSizeLabel');
    const secondaryTimerSizeInput = document.getElementById('secondaryTimerSize');
    const secondaryTimerSizeLabel = document.getElementById('secondaryTimerSizeLabel');
    
    const categorySuggestions = document.getElementById('categorySuggestions');
    const sessionTypeSuggestions = document.getElementById('sessionTypeSuggestions');
    
    let sessions = [];
    let editingSessionId = null;
    const LOCAL_STORAGE_PREFIX = 'race_schedule_';
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

    // --- GESTION DE LA MODALE ---
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

    // --- GESTION DES CURSEURS ---
    preSessionWarningTimeInput.addEventListener('input', (e) => preSessionWarningTimeLabel.textContent = e.target.value);
    mainTimerSizeInput.addEventListener('input', (e) => mainTimerSizeLabel.textContent = e.target.value);
    titleSizeInput.addEventListener('input', (e) => titleSizeLabel.textContent = e.target.value);
    secondaryTimerSizeInput.addEventListener('input', (e) => secondaryTimerSizeLabel.textContent = e.target.value);

    // --- GESTION DE LA CASE A COCHER "SÉANCE MÉCANICIEN" ---
    isMechanicSessionCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            categoryFormGroup.style.display = 'none';
            categoryInput.required = false; 
        } else {
            categoryFormGroup.style.display = 'block';
            categoryInput.required = true;
        }
    });

    // --- FONCTIONS PRINCIPALES ---
    function generateId() {
        return '_' + Math.random().toString(36).substr(2, 9);
    }

    function checkSessionOverlap(newSessionDetails, existingSessions, currentEditingId) {
        const newDay = parseInt(newSessionDetails.dayOfWeek);
        const [newStartH, newStartM] = newSessionDetails.time.split(':').map(Number);
        const newStartTimeInMinutes = (newStartH * 60) + newStartM;
        const newEndTimeInMinutes = newStartTimeInMinutes + parseInt(newSessionDetails.duration);
        const isNewSessionMechanic = newSessionDetails.isMechanic;

        for (const existingSession of existingSessions) {
            if (currentEditingId && existingSession.id === currentEditingId) {
                continue;
            }
            if (!!existingSession.isMechanic === isNewSessionMechanic) {
                if (parseInt(existingSession.dayOfWeek) === newDay) {
                    const [existingStartH, existingStartM] = existingSession.time.split(':').map(Number);
                    const existingStartTimeInMinutes = (existingStartH * 60) + existingStartM;
                    const existingEndTimeInMinutes = existingStartTimeInMinutes + parseInt(existingSession.duration);

                    if (newStartTimeInMinutes < existingEndTimeInMinutes && newEndTimeInMinutes > existingStartTimeInMinutes) {
                        return true; 
                    }
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
                
                const dayBadge = `<span class="session-day-badge">${dayNames[session.dayOfWeek]}</span>`;
                const sessionDisplay = session.isMechanic 
                    ? `<i class="fas fa-wrench icon" title="Séance Mécanicien" style="color: var(--color-accent-secondary);"></i> <strong>${session.time}</strong> (${session.duration} min) - ${session.sessionType}`
                    : `<span class="session-day-badge" style="background-color: var(--color-accent-primary); color: var(--color-background-dark);">${session.category}</span> <strong>${session.time}</strong> (${session.duration} min) - ${session.sessionType}`;

                li.innerHTML = `
                    <div class="session-info">
                        ${dayBadge}
                        ${sessionDisplay}
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
        const uniqueCategories = [...new Set(sessions.filter(s => !s.isMechanic).map(s => s.category))];
        const uniqueSessionTypes = [...new Set(sessions.map(s => s.sessionType))];
        categorySuggestions.innerHTML = uniqueCategories.map(c => `<option value="${c}"></option>`).join('');
        sessionTypeSuggestions.innerHTML = uniqueSessionTypes.map(st => `<option value="${st}"></option>`).join('');
    }

    sessionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const isMechanic = isMechanicSessionCheckbox.checked;
        const dayOfWeek = parseInt(sessionDayInput.value);
        const category = isMechanic ? '' : categoryInput.value.trim();
        const sessionType = sessionTypeInput.value.trim();
        const time = startTimeInput.value; 
        const duration = parseInt(durationInput.value);

        if (isNaN(dayOfWeek) || (!isMechanic && !category) || !sessionType || !time || !duration || duration <= 0) {
            alert('Veuillez remplir tous les champs correctement (Catégorie Pilote est requise si ce n\'est pas une séance mécanicien).'); 
            return;
        }

        const sessionCandidate = { isMechanic, dayOfWeek, time, duration };
        
        if (checkSessionOverlap(sessionCandidate, sessions, editingSessionId)) {
            const type = isMechanic ? "mécanicien" : "pilote";
            alert(`Erreur : Conflit d'horaire ! Cette séance se chevauche avec une autre séance de type '${type}' le même jour.`);
            return; 
        }

        const sessionData = { 
            id: editingSessionId || generateId(),
            isMechanic, 
            dayOfWeek, 
            category, 
            sessionType, 
            time, 
            duration 
        };

        if (editingSessionId) {
            const index = sessions.findIndex(s => s.id === editingSessionId);
            if (index > -1) {
                sessions[index] = sessionData;
            }
        } else {
            sessions.push(sessionData);
        }
        
        editingSessionId = null;
        addSessionBtn.innerHTML = '<i class="fas fa-check icon"></i> Ajouter/Valider';
        sessionForm.reset();
        isMechanicSessionCheckbox.checked = false; 
        categoryFormGroup.style.display = 'block';
        sessionDayInput.value = dayOfWeek; 
        
        renderAdminList();
    });

    clearFormBtn.addEventListener('click', () => {
        sessionForm.reset();
        const today = new Date().getDay();
        sessionDayInput.value = today;
        isMechanicSessionCheckbox.checked = false; 
        categoryFormGroup.style.display = 'block';
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
                isMechanicSessionCheckbox.checked = !!session.isMechanic;
                isMechanicSessionCheckbox.dispatchEvent(new Event('change'));
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
            isMechanicSessionCheckbox.checked = false; 
            categoryFormGroup.style.display = 'block';
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
            alert('Veuillez donner un nom au planning.');
            scheduleNameInput.focus();
            return;
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
            if (loadScheduleSelect.value !== name) {
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
            alert('Veuillez sélectionner un planning à charger.');
            return;
        }
        const savedScheduleJSON = localStorage.getItem(LOCAL_STORAGE_PREFIX + name);
        if (savedScheduleJSON) {
            try {
                const loadedData = JSON.parse(savedScheduleJSON);
                
                const normalizeSessions = (sessionList) => {
                    if (!Array.isArray(sessionList)) return [];
                    return sessionList.map(s => ({
                        ...s,
                        isMechanic: !!s.isMechanic,
                        id: s.id || generateId()
                    }));
                };

                if (loadedData.sessions && loadedData.settings) {
                    sessions = normalizeSessions(loadedData.sessions);
                    preSessionWarningTimeInput.value = loadedData.settings.preSessionWarningMinutes || 15;
                    mainTimerSizeInput.value = loadedData.settings.mainTimerSize || 100;
                    titleSizeInput.value = loadedData.settings.titleSize || 100;
                    secondaryTimerSizeInput.value = loadedData.settings.secondaryTimerSize || 100;
                } else {
                    sessions = normalizeSessions(loadedData);
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
            alert('Aucun planning actif à supprimer (vérifiez le nom du planning).');
            return;
        }
        if (!localStorage.getItem(LOCAL_STORAGE_PREFIX + name)) {
            alert(`Le planning nommé '${name}' n'existe pas dans le stockage.`);
            return;
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
    
    const launchDisplay = (viewType) => {
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
        
        let url = `display.html?schedule=${encodeURIComponent(name)}&view=${viewType}`;
        window.open(url, '_blank');
    };

    launchDisplayBtn.addEventListener('click', () => launchDisplay('pilote'));
    launchMechanicDisplayBtn.addEventListener('click', () => launchDisplay('mecanicien'));


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