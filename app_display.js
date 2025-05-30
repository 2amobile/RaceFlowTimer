document.addEventListener('DOMContentLoaded', () => {
    const currentTimeDisplay = document.getElementById('currentTimeDisplay');
    const currentScheduleNameDisplay = document.getElementById('currentScheduleNameDisplay');
    const mainCountdownStatus = document.getElementById('mainCountdownStatus');
    const mainCountdownCategory = document.getElementById('mainCountdownCategory');
    const mainCountdownSessionType = document.getElementById('mainCountdownSessionType');
    const mainCountdownTimer = document.getElementById('mainCountdownTimer');
    const upcomingSessionsList = document.getElementById('upcomingSessionsList');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    let sessions = [];
    let mainInterval;
    let currentPreSessionWarningMinutes = 15; // Valeur par défaut, sera écrasée par le planning
    const LOCAL_STORAGE_PREFIX = 'race_schedule_';
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const dayNamesShort = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

    const categoryColors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#247BA0', 
        '#F0B67F', '#8A9B0F', '#C62E65', '#E29578', '#5465FF',
        '#FDAC53', '#9BB7D4', '#B55A30', '#F56991', '#8C82FC'
    ];
    let assignedCategoryColors = {};
    let colorIndex = 0;

    function getCategoryColor(category) {
        if (!assignedCategoryColors[category]) {
            assignedCategoryColors[category] = categoryColors[colorIndex % categoryColors.length];
            colorIndex++;
        }
        return assignedCategoryColors[category];
    }

    function formatTimeWithSecondsForDisplay(date) {
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    
    function getSessionDateTime(sessionDayOfWeek, sessionTimeHHMM) {
        const now = new Date();
        const currentDayOfWeek = now.getDay(); 
        const [hours, minutes] = sessionTimeHHMM.split(':').map(Number);
        let dayOffset = sessionDayOfWeek - currentDayOfWeek;
        const sessionDate = new Date(now);
        sessionDate.setDate(now.getDate() + dayOffset); 
        sessionDate.setHours(hours, minutes, 0, 0); 
        return sessionDate;
    }

    function loadScheduleFromUrlAndStorage() {
        const urlParams = new URLSearchParams(window.location.search);
        const scheduleName = urlParams.get('schedule');

        assignedCategoryColors = {}; // Réinitialiser les couleurs à chaque chargement de planning
        colorIndex = 0;

        if (currentScheduleNameDisplay) {
            currentScheduleNameDisplay.textContent = scheduleName ? `Planning: ${scheduleName}` : "Aucun Planning";
        }
        
        if (!scheduleName) {
            displayError("Erreur", "Aucun planning", "n'a été spécifié.", "!!:!!");
            return false;
        }

        const savedScheduleJSON = localStorage.getItem(LOCAL_STORAGE_PREFIX + scheduleName);
        if (savedScheduleJSON) {
            try {
                const loadedData = JSON.parse(savedScheduleJSON);
                if (loadedData.sessions && loadedData.settings) { // Nouveau format
                    sessions = loadedData.sessions;
                    currentPreSessionWarningMinutes = parseInt(loadedData.settings.preSessionWarningMinutes) || 15;
                } else { // Ancien format
                    sessions = loadedData; // C'est directement le tableau des sessions
                    currentPreSessionWarningMinutes = 15; // Valeur par défaut
                }
                return true;
            } catch (error) {
                displayError("Erreur", "Planning corrompu", scheduleName, "XX:XX");
                console.error('Error parsing schedule:', error);
                return false;
            }
        } else {
            displayError("Erreur", "Planning introuvable", scheduleName, "??:??");
            return false;
        }
    }

    function displayError(status, cat, type, timer) {
        if(mainCountdownStatus) mainCountdownStatus.textContent = status;
        if(mainCountdownCategory) mainCountdownCategory.textContent = cat;
        if(mainCountdownSessionType) mainCountdownSessionType.textContent = type;
        if(mainCountdownTimer) mainCountdownTimer.textContent = timer;
        if(upcomingSessionsList) upcomingSessionsList.innerHTML = '<li class="empty-state">Vérifiez la console pour les détails.</li>';
    }


    function updateDisplayLogic() {
        const now = new Date();
        if (currentTimeDisplay) currentTimeDisplay.textContent = formatTimeWithSecondsForDisplay(now);

        if (!sessions || sessions.length === 0) {
            // Si loadScheduleFromUrlAndStorage a été appelé et a échoué, sessions sera vide
            // et l'erreur aura déjà été affichée. Si le planning chargé est vide, on affiche un message.
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('schedule')) { // Si un planning était censé être chargé
                 mainCountdownStatus.textContent = "PLANNING VIDE";
                 mainCountdownCategory.textContent = "--";
                 mainCountdownSessionType.textContent = "--";
                 mainCountdownTimer.textContent = "--:--";
                 if(upcomingSessionsList) upcomingSessionsList.innerHTML = '<li class="empty-state">Ce planning ne contient aucune séance.</li>';
            }
            return;
        }

        const processedSessions = sessions.map(s => ({
            ...s,
            dateTime: getSessionDateTime(s.dayOfWeek, s.time)
        })).sort((a, b) => a.dateTime - b.dateTime);


        let currentSession = null;
        let nextSession = null;
        
        for (const session of processedSessions) {
            const sessionEnd = new Date(session.dateTime.getTime() + session.duration * 60000);

            if (session.dateTime <= now && now < sessionEnd) {
                currentSession = session;
                break; 
            } else if (session.dateTime > now && !nextSession) {
                nextSession = session;
            }
        }
        
        let upcomingForDisplay = [];
        if (currentSession) {
            const currentSessionEnd = new Date(currentSession.dateTime.getTime() + currentSession.duration * 60000);
            upcomingForDisplay = processedSessions.filter(s => s.dateTime > currentSessionEnd).slice(0, 5);
        } else if (nextSession) {
            const nextSessionIndex = processedSessions.findIndex(s => s.id === nextSession.id);
            if (nextSessionIndex !== -1) {
                 upcomingForDisplay = processedSessions.slice(nextSessionIndex, nextSessionIndex + 5);
            }
        } else { 
             upcomingForDisplay = [];
        }

        mainCountdownTimer.classList.remove('imminent', 'active');
        mainCountdownTimer.style.animation = 'none'; 

        if (currentSession) {
            const sessionEnd = new Date(currentSession.dateTime.getTime() + currentSession.duration * 60000);
            const remainingMillis = sessionEnd - now;
            const remainingSeconds = Math.max(0, Math.floor(remainingMillis / 1000));
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;

            mainCountdownStatus.textContent = `${dayNames[currentSession.dayOfWeek]} - EN COURS`;
            mainCountdownCategory.textContent = currentSession.category;
            mainCountdownSessionType.textContent = currentSession.sessionType;
            mainCountdownTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            mainCountdownTimer.classList.add('active');
            void mainCountdownTimer.offsetWidth;
            if (mainCountdownTimer.style.animation !== 'pulse-green-border 1.5s infinite') {
                 mainCountdownTimer.style.animation = 'pulse-green-border 1.5s infinite';
            }
        } else if (nextSession) {
            const timeToNextSessionMillis = nextSession.dateTime - now;
            const timeToNextSessionSeconds = Math.max(0, Math.floor(timeToNextSessionMillis / 1000));

            mainCountdownCategory.textContent = nextSession.category;
            mainCountdownSessionType.textContent = nextSession.sessionType;

            if (timeToNextSessionMillis <= currentPreSessionWarningMinutes * 60 * 1000 && timeToNextSessionMillis > 0) {
                const days = Math.floor(timeToNextSessionSeconds / (24 * 60 * 60));
                const hours = Math.floor((timeToNextSessionSeconds % (24*60*60)) / (60*60));
                const minutes = Math.floor((timeToNextSessionSeconds % (60 * 60)) / 60);
                const seconds = timeToNextSessionSeconds % 60;
                
                mainCountdownStatus.textContent = `${dayNames[nextSession.dayOfWeek]} - DÉBUT DANS`;
                if (days > 0) {
                     mainCountdownTimer.textContent = `${days}j ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                } else if (hours > 0) {
                     mainCountdownTimer.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                } else {
                    mainCountdownTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                }
                mainCountdownTimer.classList.add('imminent');
                void mainCountdownTimer.offsetWidth;
                 if (mainCountdownTimer.style.animation !== 'pulse-orange-border 1.5s infinite') {
                    mainCountdownTimer.style.animation = 'pulse-orange-border 1.5s infinite';
                }
            } else if (timeToNextSessionMillis > 0) {
                mainCountdownStatus.textContent = `${dayNames[nextSession.dayOfWeek]} - PROCHAINE À`;
                mainCountdownTimer.textContent = nextSession.time; 
            } else { 
                 mainCountdownStatus.textContent = `CALCUL EN COURS`;
                 mainCountdownCategory.textContent = "--";
                 mainCountdownSessionType.textContent = "--";
                 mainCountdownTimer.textContent = "--:--";
            }
        } else {
            mainCountdownStatus.textContent = "TOUTES SÉANCES TERMINÉES";
            mainCountdownCategory.textContent = "--";
            mainCountdownSessionType.textContent = "--";
            mainCountdownTimer.textContent = "--:--";
        }

        upcomingSessionsList.innerHTML = '';
        if (upcomingForDisplay.length > 0) {
            upcomingForDisplay.forEach(session => {
                const li = document.createElement('li');
                const dayBadge = now.getDay() !== session.dayOfWeek ? `<span class="session-day-badge">${dayNamesShort[session.dayOfWeek]}</span>` : '';
                const categoryColor = getCategoryColor(session.category);
                li.style.borderLeftColor = categoryColor;
                li.innerHTML = `${dayBadge}<strong>${session.time}</strong> (${session.duration} min) - ${session.category} - ${session.sessionType}`;
                upcomingSessionsList.appendChild(li);
            });
        } else if (!currentSession && !nextSession && sessions.length > 0){ 
             upcomingSessionsList.innerHTML = '<li class="empty-state">Toutes les séances sont terminées.</li>';
        } else if (sessions.length > 0 && upcomingForDisplay.length === 0 && (currentSession || nextSession)) {
             upcomingSessionsList.innerHTML = '<li class="empty-state">Plus d\'autres séances à venir.</li>';
        }
    }
    
    if(fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    alert(`Erreur lors du passage en plein écran: ${err.message} (${err.name})`);
                });
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        });
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                 fullscreenBtn.innerHTML = '<i class="fas fa-expand icon"></i> Plein Écran';
            } else {
                 fullscreenBtn.innerHTML = '<i class="fas fa-compress icon"></i> Quitter Plein Écran';
            }
        });
    }


    function initDisplay() {
        if (loadScheduleFromUrlAndStorage()) { 
            if (mainInterval) clearInterval(mainInterval);
            updateDisplayLogic(); 
            mainInterval = setInterval(updateDisplayLogic, 1000);
        } else {
            if(currentTimeDisplay) currentTimeDisplay.textContent = formatTimeWithSecondsForDisplay(new Date());
            setInterval(() => {
                if(currentTimeDisplay) currentTimeDisplay.textContent = formatTimeWithSecondsForDisplay(new Date());
            }, 1000);
        }
    }
    initDisplay();
});