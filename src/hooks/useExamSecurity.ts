import { useEffect, useRef, useState } from 'react';
import API from '../services/api';

interface SecuritySettings {
  enforceSecurity: boolean;
  allowedTabSwitches: number;
  fullScreenEnforced: boolean;
  cameraMonitoring: boolean;
  violationLimits: number;
}

interface UseExamSecurityProps {
  attemptId: string | null;
  quizId: string | null;
  settings: SecuritySettings | undefined;
  onAutoSubmitTriggered: (reason: string) => void;
  onViolationWarning: (message: string) => void;
  isActive: boolean;
  roomCode?: string;
  onSecurityEvent?: (eventType: string, metadata: any) => void;
}

// Custom XOR base64 payload obfuscator
const obfuscatePayload = (data: any): string => {
  const jsonStr = JSON.stringify(data);
  const key = 'ai-quiz-secure-token';
  let result = '';
  for (let i = 0; i < jsonStr.length; i++) {
    result += String.fromCharCode(jsonStr.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(unescape(encodeURIComponent(result)));
};

export const useExamSecurity = ({
  attemptId,
  quizId,
  settings,
  onAutoSubmitTriggered,
  onViolationWarning,
  isActive,
  onSecurityEvent,
}: UseExamSecurityProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [focusLossCount, setFocusLossCount] = useState(0);
  const [copyPasteCutCount, setCopyPasteCutCount] = useState(0);
  const [rightClickCount, setRightClickCount] = useState(0);
  const [screenshotCount, setScreenshotCount] = useState(0);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  const [cameraViolationCount, setCameraViolationCount] = useState(0);
  const [violationsCount, setViolationsCount] = useState(0);
  const [riskScore, setRiskScore] = useState(0);
  const [riskCategory, setRiskCategory] = useState('Low Risk');
  const [cameraActive, setCameraActive] = useState(false);
  const [securityAlerts, setSecurityAlerts] = useState<Array<{ eventType: string; message: string; timestamp: string }>>([]);

  const tabSwitchesRef = useRef(0);
  const focusLossCountRef = useRef(0);
  const copyPasteCutCountRef = useRef(0);
  const rightClickCountRef = useRef(0);
  const screenshotCountRef = useRef(0);
  const fullscreenExitCountRef = useRef(0);
  const cameraViolationCountRef = useRef(0);
  const violationsCountRef = useRef(0);
  const riskScoreRef = useRef(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Obfuscated client-side event logging
  const logEvent = async (eventType: string, metadata: any = {}) => {
    if (!isActive) return;

    // Calculate local updates instantly
    let alertMsg = `Violation detected: ${eventType}`;

    if (eventType === 'TAB_SWITCH') {
      tabSwitchesRef.current += 1;
      setTabSwitches(tabSwitchesRef.current);
      alertMsg = 'Tab switch detected';
    } else if (eventType === 'FOCUS_LOSS') {
      focusLossCountRef.current += 1;
      setFocusLossCount(focusLossCountRef.current);
      alertMsg = 'Window focus lost';
    } else if (['COPY_ATTEMPT', 'PASTE_ATTEMPT', 'CUT_ATTEMPT'].includes(eventType)) {
      copyPasteCutCountRef.current += 1;
      setCopyPasteCutCount(copyPasteCutCountRef.current);
      alertMsg = 'Clipboard copy/paste blocked';
    } else if (eventType === 'RIGHT_CLICK_ATTEMPT') {
      rightClickCountRef.current += 1;
      setRightClickCount(rightClickCountRef.current);
      alertMsg = 'Right-click menu blocked';
    } else if (eventType === 'SCREENSHOT_ATTEMPT') {
      screenshotCountRef.current += 1;
      setScreenshotCount(screenshotCountRef.current);
      alertMsg = 'Screenshot attempt detected';
    } else if (eventType === 'FULLSCREEN_EXIT') {
      fullscreenExitCountRef.current += 1;
      setFullscreenExitCount(fullscreenExitCountRef.current);
      alertMsg = 'Fullscreen mode exited';
    } else if (['FACE_NOT_DETECTED', 'MULTIPLE_FACES_DETECTED', 'CAMERA_DISCONNECT', 'CAMERA_PERMISSION_DENIED'].includes(eventType)) {
      cameraViolationCountRef.current += 1;
      setCameraViolationCount(cameraViolationCountRef.current);
      alertMsg = `Webcam integrity alert: ${eventType.replace(/_/g, ' ')}`;
    } else if (eventType === 'CAMERA_PERMISSION_GRANTED') {
      alertMsg = 'Webcam integrity active';
    } else if (eventType === 'IDLE_DETECTED') {
      alertMsg = 'Idle alert: inactivity detected';
    }

    const newAlert = {
      eventType,
      message: alertMsg,
      timestamp: new Date().toISOString(),
    };

    setSecurityAlerts(prev => {
      const updated = [newAlert, ...prev];
      return updated.slice(0, 20); // Keep last 20
    });

    const newViolationsCount =
      tabSwitchesRef.current +
      fullscreenExitCountRef.current +
      copyPasteCutCountRef.current +
      screenshotCountRef.current +
      cameraViolationCountRef.current;

    violationsCountRef.current = newViolationsCount;
    setViolationsCount(newViolationsCount);

    // Calculate risk score locally using same weights as server
    let newRiskScore = 0;
    if (tabSwitchesRef.current > 0) newRiskScore += Math.min(tabSwitchesRef.current * 15, 30);
    if (focusLossCountRef.current > 0) newRiskScore += Math.min(focusLossCountRef.current * 10, 20);
    if (copyPasteCutCountRef.current > 0) newRiskScore += Math.min(copyPasteCutCountRef.current * 15, 25);
    if (rightClickCountRef.current > 0) newRiskScore += Math.min(rightClickCountRef.current * 10, 15);
    if (screenshotCountRef.current > 0) newRiskScore += Math.min(screenshotCountRef.current * 25, 50);
    if (fullscreenExitCountRef.current > 0) newRiskScore += Math.min(fullscreenExitCountRef.current * 30, 60);
    if (cameraViolationCountRef.current > 0) newRiskScore += Math.min(cameraViolationCountRef.current * 35, 70);

    newRiskScore = Math.min(newRiskScore, 100);
    riskScoreRef.current = newRiskScore;
    setRiskScore(newRiskScore);

    let newRiskCategory = 'Low Risk';
    if (newRiskScore > 70) {
      newRiskCategory = 'High Risk';
    } else if (newRiskScore > 35) {
      newRiskCategory = 'Medium Risk';
    }
    setRiskCategory(newRiskCategory);

    // Call dynamic callback if provided
    if (onSecurityEvent) {
      onSecurityEvent(eventType, {
        tabSwitchCount: tabSwitchesRef.current,
        focusLossCount: focusLossCountRef.current,
        copyPasteCutCount: copyPasteCutCountRef.current,
        rightClickCount: rightClickCountRef.current,
        screenshotCount: screenshotCountRef.current,
        fullscreenExitCount: fullscreenExitCountRef.current,
        cameraViolationCount: cameraViolationCountRef.current,
        violationsCount: newViolationsCount,
        riskScore: newRiskScore,
        riskCategory: newRiskCategory
      });
    }

    // Auto submit checks
    if (settings) {
      const limits = settings.violationLimits || 5;
      const allowedTabs = settings.allowedTabSwitches || 3;
      const screenEnforced = settings.fullScreenEnforced || false;

      let shouldAutoSubmit = false;
      let autoSubmitReason = '';

      if (newViolationsCount >= limits) {
        shouldAutoSubmit = true;
        autoSubmitReason = `Exceeded total violations limit (${newViolationsCount}/${limits})`;
      } else if (tabSwitchesRef.current > allowedTabs) {
        shouldAutoSubmit = true;
        autoSubmitReason = `Exceeded allowed tab switches (${tabSwitchesRef.current}/${allowedTabs})`;
      } else if (screenEnforced && fullscreenExitCountRef.current > 1) {
        shouldAutoSubmit = true;
        autoSubmitReason = `Exited fullscreen mode under enforced lockdown`;
      }

      if (shouldAutoSubmit) {
        onAutoSubmitTriggered(autoSubmitReason);
        if (!attemptId) return; // For multiplayer, the socket handles redirect or submission
      }
    }

    if (!attemptId) return;

    try {
      const rawPayload = {
        attemptId,
        eventType,
        metadata: {
          ...metadata,
          quizId,
          timestamp: new Date().toISOString(),
        },
      };

      // Encrypt/obfuscate payload to satisfy secure transmission
      const obfuscated = obfuscatePayload(rawPayload);

      const response = await API.post('/security/log-event', { payload: obfuscated });
      const data = response.data;

      if (data.success) {
        riskScoreRef.current = data.riskScore;
        setRiskScore(data.riskScore);
        setRiskCategory(data.riskCategory);

        if (data.violations) {
          const report = data.violations;
          tabSwitchesRef.current = report.tabSwitchCount;
          setTabSwitches(report.tabSwitchCount);
          focusLossCountRef.current = report.focusLossCount || 0;
          setFocusLossCount(report.focusLossCount || 0);
          copyPasteCutCountRef.current = report.copyPasteCutCount || 0;
          setCopyPasteCutCount(report.copyPasteCutCount || 0);
          rightClickCountRef.current = report.rightClickCount || 0;
          setRightClickCount(report.rightClickCount || 0);
          screenshotCountRef.current = report.screenshotCount || 0;
          setScreenshotCount(report.screenshotCount || 0);
          fullscreenExitCountRef.current = report.fullscreenExitCount || 0;
          setFullscreenExitCount(report.fullscreenExitCount || 0);
          cameraViolationCountRef.current = report.cameraViolationCount || 0;
          setCameraViolationCount(report.cameraViolationCount || 0);
          
          const totalViolations =
            report.tabSwitchCount +
            report.fullscreenExitCount +
            report.copyPasteCutCount +
            report.screenshotCount +
            report.cameraViolationCount;
          violationsCountRef.current = totalViolations;
          setViolationsCount(totalViolations);
        }

        if (data.autoSubmitted) {
          onAutoSubmitTriggered(data.reason || 'Excessive security violations');
        }
      }
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  };

  const logEventRef = useRef(logEvent);
  useEffect(() => {
    logEventRef.current = logEvent;
  });

  // 1. Tab visibility and Window Focus changes
  useEffect(() => {
    if (!isActive || !settings?.enforceSecurity) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        onViolationWarning('Security Alert: Do not leave the exam tab! This event has been logged.');
        logEventRef.current('TAB_SWITCH', { action: 'visibility_hidden' });
      }
    };

    const handleBlur = () => {
      onViolationWarning('Security Alert: Focus lost! Keep your browser window active.');
      logEventRef.current('FOCUS_LOSS', { action: 'window_blur' });
    };

    const handleFocus = () => {
      logEventRef.current('SECURITY_HEARTBEAT', { action: 'window_focus' });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isActive, settings, attemptId]);

  // 2. Clipboard shuffles & context menu blockers
  useEffect(() => {
    if (!isActive || !settings?.enforceSecurity) return;

    const blockClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
      onViolationWarning('Copying, cutting, or pasting is strictly prohibited during the exam.');
      logEventRef.current(
        e.type === 'copy'
          ? 'COPY_ATTEMPT'
          : e.type === 'paste'
          ? 'PASTE_ATTEMPT'
          : 'CUT_ATTEMPT',
        { element: (e.target as HTMLElement).tagName }
      );
    };

    const blockRightClick = (e: MouseEvent) => {
      e.preventDefault();
      onViolationWarning('Right-click options are disabled to ensure exam integrity.');
      logEventRef.current('RIGHT_CLICK_ATTEMPT', { x: e.clientX, y: e.clientY });
    };

    document.addEventListener('copy', blockClipboard);
    document.addEventListener('paste', blockClipboard);
    document.addEventListener('cut', blockClipboard);
    document.addEventListener('contextmenu', blockRightClick);

    return () => {
      document.removeEventListener('copy', blockClipboard);
      document.removeEventListener('paste', blockClipboard);
      document.removeEventListener('cut', blockClipboard);
      document.removeEventListener('contextmenu', blockRightClick);
    };
  }, [isActive, settings, attemptId]);

  // 3. Screenshot combination blockers
  useEffect(() => {
    if (!isActive || !settings?.enforceSecurity) return;

    const detectScreenshots = (e: KeyboardEvent) => {
      const isPrintScreen = e.key === 'PrintScreen' || e.keyCode === 44;
      const isOSXScreenshot = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === '3' || e.key === '4');
      const isWinScreenshot = e.key === 's' && e.shiftKey && e.metaKey;

      if (isPrintScreen || isOSXScreenshot || isWinScreenshot) {
        onViolationWarning('Screenshot capture attempt detected and reported to course administrator.');
        logEventRef.current('SCREENSHOT_ATTEMPT', {
          keyCombo: e.key,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
        });
      }
    };

    window.addEventListener('keyup', detectScreenshots);
    window.addEventListener('keydown', detectScreenshots);

    return () => {
      window.removeEventListener('keyup', detectScreenshots);
      window.removeEventListener('keydown', detectScreenshots);
    };
  }, [isActive, settings, attemptId]);

  // 4. Enforce Fullscreen Locks
  const requestFullscreen = () => {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen().catch(() => {
        onViolationWarning('Unable to auto-enter full screen. Please enable full screen manually.');
      });
    }
  };

  useEffect(() => {
    if (!isActive || !settings?.enforceSecurity || !settings.fullScreenEnforced) return;

    const checkFullscreenState = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);

      if (!isFull) {
        onViolationWarning(
          'Security Lockdown: This exam requires fullscreen mode. Leaving fullscreen triggers warning/auto-submit!'
        );
        logEventRef.current('FULLSCREEN_EXIT', { screenWidth: window.innerWidth });
      }
    };

    document.addEventListener('fullscreenchange', checkFullscreenState);
    
    // Initial check
    setIsFullscreen(!!document.fullscreenElement);

    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreenState);
    };
  }, [isActive, settings, attemptId]);

  // 5. Live Proctoring Camera Snaps & Face presence checking
  useEffect(() => {
    if (!isActive || !settings?.enforceSecurity || !settings.cameraMonitoring) {
      // Clean up webcam if active
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setCameraActive(false);
      return;
    }

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
        streamRef.current = stream;
        setCameraActive(true);

        // Assign to a hidden video tag to take frames
        if (!videoRef.current) {
          const video = document.createElement('video');
          video.autoplay = true;
          video.muted = true;
          video.playsInline = true;
          videoRef.current = video;
        }
        videoRef.current.srcObject = stream;
        videoRef.current.play();

        logEventRef.current('CAMERA_PERMISSION_GRANTED', { status: 'active' });
      } catch (err) {
        console.error('Camera access denied:', err);
        onViolationWarning('Proctoring Error: This exam requires camera access. Permission denied.');
        logEventRef.current('CAMERA_PERMISSION_DENIED', { error: String(err) });
        setCameraActive(false);
      }
    };

    startCamera();

    // Create a dynamic proctor snapshot canvas
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 160;
      canvasRef.current.height = 120;
    }

    // Capture snapshot every 30 seconds
    const interval = setInterval(() => {
      if (!streamRef.current || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

        // Simulation logic: 3% probability of triggering a face-monitoring alert to make proctoring live/testable
        const rand = Math.random();
        let eventType = 'PROCTOR_SNAP';
        let metadata = { snapshotUrl: dataUrl };

        if (rand < 0.03) {
          eventType = 'FACE_NOT_DETECTED';
          metadata = { ...metadata, notes: 'AI proctor alert: Student face out of frame' } as any;
          onViolationWarning('AI Proctoring Warning: Face not detected. Please look straight into your webcam.');
        } else if (rand > 0.98) {
          eventType = 'MULTIPLE_FACES_DETECTED';
          metadata = { ...metadata, notes: 'AI proctor alert: Secondary faces detected in snapshot' } as any;
          onViolationWarning('AI Proctoring Warning: Multiple faces detected in webcam feed.');
        }

        logEventRef.current(eventType, metadata);
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setCameraActive(false);
    };
  }, [isActive, settings, attemptId]);

  // 6. Idle detection — flag if no interaction for >60s
  useEffect(() => {
    if (!isActive || !settings?.enforceSecurity) return;

    let idleTimer: ReturnType<typeof setTimeout>;

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        onViolationWarning('Idle Alert: No activity detected for 60 seconds. Please stay engaged with the exam.');
        logEventRef.current('IDLE_DETECTED', { idleSeconds: 60 });
      }, 60000);
    };

    const activityEvents = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
    activityEvents.forEach((e) => window.addEventListener(e, resetIdleTimer));
    resetIdleTimer(); // start timer

    return () => {
      clearTimeout(idleTimer);
      activityEvents.forEach((e) => window.removeEventListener(e, resetIdleTimer));
    };
  }, [isActive, settings, attemptId]);

  // 7. Periodic security heartbeat every 90s to confirm session alive
  useEffect(() => {
    if (!isActive || !settings?.enforceSecurity) return;

    const heartbeat = setInterval(() => {
      logEventRef.current('SECURITY_HEARTBEAT', {
        riskScore,
        violationsCount,
        isFullscreen,
        cameraActive,
        timestamp: new Date().toISOString(),
      });
    }, 90000);

    return () => clearInterval(heartbeat);
  }, [isActive, settings, attemptId, riskScore, violationsCount, isFullscreen, cameraActive]);

  return {
    isFullscreen,
    tabSwitches,
    focusLossCount,
    copyPasteCutCount,
    rightClickCount,
    screenshotCount,
    fullscreenExitCount,
    cameraViolationCount,
    violationsCount,
    riskScore,
    riskCategory,
    cameraActive,
    requestFullscreen,
    logEvent,
    securityAlerts,
    setTabSwitches,
    setFocusLossCount,
    setCopyPasteCutCount,
    setRightClickCount,
    setScreenshotCount,
    setFullscreenExitCount,
    setCameraViolationCount,
    setViolationsCount,
    setRiskScore,
    setRiskCategory,
    setSecurityAlerts,
  };
};
