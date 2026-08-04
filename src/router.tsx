import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import { SonificationPage } from "./pages/SonificationPage";
import { ShowcasePage } from "./pages/ShowcasePage";
import { VerificationPage } from "./pages/VerificationPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AdminPage } from "./pages/AdminPage";
import { LandingPageWrapper } from "./pages/LandingPageWrapper";
import { ProfilePage } from "./pages/ProfilePage";
import { MuseumPage } from "./pages/MuseumPage";
import { PerformancePage } from "./pages/PerformancePage";
import { ErrorPage } from "./components/ErrorPage";
import { ComparePage } from "./pages/ComparePage";
import { CamPage } from "./pages/CamPage";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <App />,
        errorElement: <ErrorPage />,
        children: [
            { index: true, element: <LandingPageWrapper /> },
            { path: "sonification", element: <SonificationPage /> },
            { path: "cam", element: <CamPage /> },
            { path: "showcase", element: <ShowcasePage /> },
            { path: "verification", element: <VerificationPage /> },
            { path: "compare", element: <ComparePage /> },
            { path: "dashboard", element: <DashboardPage /> },
            { path: "profile", element: <ProfilePage /> },
            { path: "artist/:id", element: <ProfilePage /> },
            { path: "admin", element: <AdminPage /> },
            { path: "museum", element: <MuseumPage /> },
            { path: "live/:id", element: <PerformancePage /> },
        ],
    },
]);

