import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import { SonificationPage } from "./pages/SonificationPage";
import { ShowcasePage } from "./pages/ShowcasePage";
import { VerificationPage } from "./pages/VerificationPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AdminPage } from "./pages/AdminPage";
import { LandingPageWrapper } from "./pages/LandingPageWrapper";
import { ProfilePage } from "./pages/ProfilePage";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <App />,
        children: [
            { index: true, element: <LandingPageWrapper /> },
            { path: "sonification", element: <SonificationPage /> },
            { path: "showcase", element: <ShowcasePage /> },
            { path: "verification", element: <VerificationPage /> },
            { path: "dashboard", element: <DashboardPage /> },
            { path: "profile", element: <ProfilePage /> },
            { path: "admin", element: <AdminPage /> },
        ],
    },
]);
