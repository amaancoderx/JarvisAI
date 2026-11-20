"use client";
import { AboutPage, AuditPage, ComputersPage, ConnectionsPage, DevicePage, HowPage, InboxPage, LatencyPage, MemoryPage, RoutinesPage, SettingsPage, TaskPage, TasksPage, TodayPage } from "./Pages";
import { Shell, useRoute } from "./Shell";
import { JarvisProvider } from "./store";
import { TalkView } from "./TalkView";

function Router() {
  const [view, id, go] = useRoute();
  const page = (() => {
    switch (view) {
      case "today": return <TodayPage go={go} />;
      case "tasks": return <TasksPage go={go} />;
      case "task": return <TaskPage id={id} go={go} />;
      case "routines": return <RoutinesPage go={go} />;
      case "memory": return <MemoryPage />;
      case "inbox": return <InboxPage go={go} />;
      case "connections": return <ConnectionsPage />;
      case "computers": return <ComputersPage />;
      case "device": return <DevicePage go={go} />;
      case "about": return <AboutPage />;
      case "audit": return <AuditPage />;
      case "latency": return <LatencyPage go={go} />;
      case "settings": return <SettingsPage />;
      case "how": return <HowPage go={go} />;
      default: return <TalkView go={go} />;
    }
  })();
  return <Shell view={view} go={go}>{page}</Shell>;
}

export default function App() {
  return (
    <JarvisProvider>
      <Router />
    </JarvisProvider>
  );
}
