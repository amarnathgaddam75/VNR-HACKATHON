import { AnimatePresence, motion } from 'framer-motion';
import BedDetail from './components/BedDetail.jsx';
import { BottomNav, Header, NavRail, Timeline } from './components/Shell.jsx';
import VitalEntry from './components/VitalEntry.jsx';
import { Toasts } from './components/ui.jsx';
import Assistant from './screens/Assistant.jsx';
import Console from './screens/Console.jsx';
import Engine from './screens/Engine.jsx';
import Handover from './screens/Handover.jsx';
import Proof from './screens/Proof.jsx';
import WardMap from './screens/WardMap.jsx';
import { useWard } from './store/WardContext.jsx';

const SCREENS = { console: Console, map: WardMap, handover: Handover, assistant: Assistant, proof: Proof, engine: Engine };

export default function App() {
  const { screen, toasts } = useWard();
  const Screen = SCREENS[screen] || Console;
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <div className="flex flex-1">
        <NavRail />
        <main className="min-w-0 flex-1 px-4 pb-40 pt-5 md:pb-24 lg:px-6">
          <AnimatePresence mode="wait">
            <motion.div key={screen} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <Screen />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <Timeline />
      <BottomNav />
      <BedDetail />
      <VitalEntry />
      <Toasts toasts={toasts} />
    </div>
  );
}
