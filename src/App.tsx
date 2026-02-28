import DashboardContainer from "./components/DashboardContainer";
import SecurityGateway from "./components/SecurityGateway";

function App() {
  return (
    <SecurityGateway>
      <DashboardContainer />
    </SecurityGateway>
  );
}

export default App;
