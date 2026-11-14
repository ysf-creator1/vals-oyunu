import { useEffect } from 'react';
import { unlockAudio } from '../audio/synth';
import { useGame } from '../store/game';
import { useApplySettings } from './hooks';
import { EndlessScreen } from './screens/EndlessScreen';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { HowToScreen } from './screens/HowToScreen';
import { LevelsScreen } from './screens/LevelsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';

export function App() {
  useApplySettings();
  const screen = useGame((s) => s.screen);
  const session = useGame((s) => s.session);
  const tutorialSeen = useGame((s) => s.profile.tutorialSeen);

  // First launch: go straight into the tutorial instead of the home screen.
  useEffect(() => {
    if (tutorialSeen.length === 0 && !session) useGame.getState().continueGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  let body;
  if (screen === 'game' && session) body = <GameScreen key={session.nonce ?? session.level.id} />;
  else if (screen === 'levels') body = <LevelsScreen />;
  else if (screen === 'endless') body = <EndlessScreen />;
  else if (screen === 'stats') body = <StatsScreen />;
  else if (screen === 'settings') body = <SettingsScreen />;
  else if (screen === 'howto') body = <HowToScreen />;
  else body = <HomeScreen />;

  return <div className="app">{body}</div>;
}
