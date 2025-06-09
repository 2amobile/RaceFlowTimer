document.addEventListener('DOMContentLoaded', () => {
    const currentTimeDisplay = document.getElementById('currentTimeDisplay');
    const currentScheduleNameDisplay = document.getElementById('currentScheduleNameDisplay');
    const mainCountdownStatus = document.getElementById('mainCountdownStatus');
    const mainCountdownCategory = document.getElementById('mainCountdownCategory');
    const mainCountdownSessionType = document.getElementById('mainCountdownSessionType');
    const mainCountdownTimer = document.getElementById('mainCountdownTimer');
    const upcomingSessionsList = document.getElementById('upcomingSessionsList');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const secondaryCountdown = document.getElementById('secondaryCountdown');

    let sessions = [];
    let mainInterval;
    let settings = {
        preSessionWarningMinutes: 15,
        mainTimerSize: 100,
        titleSize: 100,
        secondaryTimerSize: 100
    };
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

    function applyDynamicStyles() {
        if (!mainCountdownTimer) return;

        const baseSizes = {
            mainTimer: 19.1664,
            titles: 4.8,      
            secondaryTimer: 4.1184 
        };

        const mainTimerMultiplier = settings.mainTimerSize / 100;
        const titleMultiplier = settings.titleSize / 100;
        const secondaryTimerMultiplier = settings.secondaryTimerSize / 100;

        mainCountdownTimer.style.fontSize = `calc(var(--dynamic-font-unit) * ${baseSizes.mainTimer * mainTimerMultiplier})`;
        
        mainCountdownCategory.style.fontSize = `calc(var(--dynamic-font-unit) * ${baseSizes.titles * titleMultiplier})`;
        mainCountdownSessionType.style.fontSize = `calc(var(--dynamic-font-unit) * ${baseSizes.titles * 0.65 * titleMultiplier})`;
        mainCountdownStatus.style.fontSize = `calc(var(--dynamic-font-unit) * ${baseSizes.titles * 0.75 * titleMultiplier})`;
        
        const upcomingTitle = document.querySelector('.upcoming-title');
        if (upcomingTitle) {
            upcomingTitle.style.fontSize = `calc(var(--dynamic-font-unit) * 3 * titleMultiplier * 0.9)`;
        }
        if (upcomingSessionsList) {
            upcomingSessionsList.style.fontSize = `calc(var(--dynamic-font-unit) * 1.8 * titleMultiplier * 0.9)`;
        }

        if (secondaryCountdown) {
            secondaryCountdown.style.fontSize = `calc(var(--dynamic-font-unit) * ${baseSizes.secondaryTimer * secondaryTimerMultiplier})`;
        }
    }

    function loadScheduleFromUrlAndStorage() {
        const urlParams = new URLSearchParams(window.location.search);
        const scheduleName = urlParams.get('schedule');
        const viewFilter = urlParams.get('view') || 'pilote'; 

        assignedCategoryColors = {}; 
        colorIndex = 0;

        let displayName = scheduleName ? `Planning: ${scheduleName}` : "Aucun Planning";
        if (viewFilter === 'mecanicien') {
            displayName += ` (Vue: Mécanicien)`; 
        }

        if (currentScheduleNameDisplay) {
            currentScheduleNameDisplay.textContent = displayName;
        }
        
        if (!scheduleName) {
            displayError("Erreur", "Aucun planning", "n'a été spécifié.", "!!:!!");
            return false;
        }

        const savedScheduleJSON = localStorage.getItem(LOCAL_STORAGE_PREFIX + scheduleName);
        if (savedScheduleJSON) {
            try {
                const loadedData = JSON.parse(savedScheduleJSON);
                
                let allSessions = []; 
                if (loadedData.sessions && loadedData.settings) {
                    allSessions = loadedData.sessions.map(s => ({...s, isMechanic: !!s.isMechanic}));
                    settings.preSessionWarningMinutes = parseInt(loadedData.settings.preSessionWarningMinutes) || 15;
                    settings.mainTimerSize = parseFloat(loadedData.settings.mainTimerSize) || 100;
                    settings.titleSize = parseFloat(loadedData.settings.titleSize) || 100;
                    settings.secondaryTimerSize = parseFloat(loadedData.settings.secondaryTimerSize) || 100;
                } else {
                    allSessions = loadedData.map(s => ({...s, isMechanic: !!s.isMechanic}));
                }

                if (viewFilter === 'mecanicien') {
                    sessions = allSessions.filter(session => session.isMechanic);
                } else { 
                    sessions = allSessions.filter(session => !session.isMechanic);
                }

                applyDynamicStyles();
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
        if(secondaryCountdown) secondaryCountdown.style.display = 'none';
        
        const now = new Date();
        if (currentTimeDisplay) currentTimeDisplay.textContent = formatTimeWithSecondsForDisplay(now);

        if (!sessions || sessions.length === 0) {
            const urlParams = new URLSearchParams(window.location.search);
            const viewFilter = urlParams.get('view') || 'pilote';
            if (urlParams.get('schedule')) {
                 if(mainCountdownStatus) mainCountdownStatus.textContent = `AUCUNE SÉANCE`;
                 if(mainCountdownCategory) mainCountdownCategory.textContent = `POUR LA VUE "${viewFilter.toUpperCase()}"`;
                 if(mainCountdownSessionType) mainCountdownSessionType.textContent = "--";
                 if(mainCountdownTimer) mainCountdownTimer.textContent = "--:--";
                 if(upcomingSessionsList) upcomingSessionsList.innerHTML = '<li class="empty-state">Aucune séance ne correspond à cette vue.</li>';
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
            } else if (session.dateTime > now && !nextSession) {
                nextSession = session;
            }
        }
        
        mainCountdownTimer.classList.remove('imminent', 'active');
        mainCountdownTimer.style.animation = 'none';

        const preSessionWarningMillis = settings.preSessionWarningMinutes * 60 * 1000;
        
        if (currentSession && nextSession && (nextSession.dateTime - now <= preSessionWarningMillis)) {
            
            const currentSessionEnd = new Date(currentSession.dateTime.getTime() + currentSession.duration * 60000);
            const remainingMillisCurrent = currentSessionEnd - now;
            const remainingSecondsCurrent = Math.max(0, Math.floor(remainingMillisCurrent / 1000));
            const minutesCurrent = Math.floor(remainingSecondsCurrent / 60);
            const secondsCurrent = remainingSecondsCurrent % 60;
            
            const currentCategoryText = currentSession.isMechanic ? '' : `${currentSession.category} - `;
            secondaryCountdown.innerHTML = `
                <i class="fas fa-play-circle icon" style="color:var(--color-success)"></i> 
                ${currentCategoryText}${currentSession.sessionType} | Temps restant : 
                <span class="highlight">${String(minutesCurrent).padStart(2, '0')}:${String(secondsCurrent).padStart(2, '0')}</span>
            `;
            secondaryCountdown.style.display = 'block';

            const timeToNextSessionMillis = nextSession.dateTime - now;
            const timeToNextSessionSeconds = Math.max(0, Math.floor(timeToNextSessionMillis / 1000));
            const minutesNext = Math.floor(timeToNextSessionSeconds / 60);
            const secondsNext = timeToNextSessionSeconds % 60;
            
            mainCountdownStatus.textContent = `${dayNames[nextSession.dayOfWeek]} - DÉBUT DANS`;
            mainCountdownCategory.textContent = nextSession.category || '';
            mainCountdownSessionType.textContent = nextSession.sessionType;
            mainCountdownTimer.textContent = `${String(minutesNext).padStart(2, '0')}:${String(secondsNext).padStart(2, '0')}`;
            mainCountdownTimer.classList.add('imminent');
            void mainCountdownTimer.offsetWidth;
            if (mainCountdownTimer.style.animation !== 'pulse-orange-border 1.5s infinite') {
               mainCountdownTimer.style.animation = 'pulse-orange-border 1.5s infinite';
            }

        } else if (currentSession) {
            const sessionEnd = new Date(currentSession.dateTime.getTime() + currentSession.duration * 60000);
            const remainingMillis = sessionEnd - now;
            const remainingSeconds = Math.max(0, Math.floor(remainingMillis / 1000));
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;

            mainCountdownStatus.textContent = `${dayNames[currentSession.dayOfWeek]} - EN COURS`;
            mainCountdownCategory.textContent = currentSession.category || '';
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

            mainCountdownCategory.textContent = nextSession.category || '';
            mainCountdownSessionType.textContent = nextSession.sessionType;

            if (timeToNextSessionMillis <= preSessionWarningMillis && timeToNextSessionMillis > 0) {
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

        let upcomingForDisplay = [];
        if (currentSession) {
            const currentSessionEnd = new Date(currentSession.dateTime.getTime() + currentSession.duration * 60000);
            upcomingForDisplay = processedSessions.filter(s => s.dateTime > currentSessionEnd).slice(0, 5);
        } else if (nextSession) {
            const nextSessionIndex = processedSessions.findIndex(s => s.id === nextSession.id);
            if (nextSessionIndex !== -1) {
                 upcomingForDisplay = processedSessions.slice(nextSessionIndex, nextSessionIndex + 5);
            }
        }

        upcomingSessionsList.innerHTML = '';
        if (upcomingForDisplay.length > 0) {
            upcomingForDisplay.forEach(session => {
                const li = document.createElement('li');
                const dayBadge = now.getDay() !== session.dayOfWeek ? `<span class="session-day-badge">${dayNamesShort[session.dayOfWeek]}</span>` : '';
                const categoryColor = session.isMechanic ? 'var(--color-accent-secondary)' : getCategoryColor(session.category);
                li.style.borderLeftColor = categoryColor;
                const categoryText = !session.isMechanic ? `${session.category} - ` : '';
                li.innerHTML = `${dayBadge}<strong>${session.time}</strong> (${session.duration} min) - ${categoryText}${session.sessionType}`;
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

    async function initDisplay() {
        // La fonction load... est maintenant asynchrone, nous utilisons await
        if (await loadScheduleFromUrlAndStorage()) { 
            if (mainInterval) clearInterval(mainInterval);
            updateDisplayLogic(); 
            mainInterval = setInterval(updateDisplayLogic, 1000);
        } else {
            // Si le chargement échoue, l'erreur est déjà affichée
            // On maintient l'horloge actuelle si elle existe
            if(currentTimeDisplay) currentTimeDisplay.textContent = formatTimeWithSecondsForDisplay(new Date());
            setInterval(() => {
                if(currentTimeDisplay) currentTimeDisplay.textContent = formatTimeWithSecondsForDisplay(new Date());
            }, 1000);
        }
    }
    initDisplay();
});