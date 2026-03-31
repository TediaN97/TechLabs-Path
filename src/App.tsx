import DashboardContainer from "./components/DashboardContainer";
import AuthGate from "./auth/AuthGate";

function App() {
  return (
    <AuthGate>
      <DashboardContainer />
    </AuthGate>
  );
}

export default App;
