
# MonitoringApp 🚀

MonitoringApp is a web application built with Angular for monitoring sensor data in real-time. It provides a dashboard for visualizing historical data, a real-time monitoring view with live charts and alerts, and the capability to generate PDF reports.

## ✨ Features

* **Dashboard View**:
    * Displays historical sensor data through interactive charts.
    * Allows filtering by sensor type (variable de entorno), location (invernadero), and date ranges.
    * Supports pagination for viewing multiple charts when no specific filter is applied or when viewing a single variable across many locations.
    * Option to view raw sensor data in a table.
* **Real-time Monitoring View**:
    * Displays live sensor data streams using charts.
    * Shows real-time text-based sensor messages and alert messages.
    * Indicates WebSocket connection status (Connected, Attempting, Disconnected, Error) and allows manual reconnection attempts.
    * Filters for real-time data visualization by sensor type and date/time window.
* **Alerting System**:
    * Displays pop-up alerts for critical, error, and warning conditions detected by sensors.
    * Shows toast notifications for various alert levels, providing immediate feedback to the user.
* **Dynamic Environment Configuration**:
    * API and WebSocket URLs are configured at runtime through environment variables, suitable for Docker deployments.

---
## 🛠️ Tech Stack

* **Frontend**:
    * Angular v19.2.x
    * Chart.js v4.4.x with `ng2-charts` v8.0.0 and `chartjs-adapter-date-fns` for data visualization.
    * RxJS for reactive programming.
    * STOMP.js and SockJS-client for WebSocket communication.
    * jsPDF and jsPDF-AutoTable for generating PDF reports.
    * SCSS for styling.
* **Development & Build Tools**:
    * Angular CLI v19.2.x
    * TypeScript v5.7.x
* **Deployment**:
    * Docker with Nginx (as inferred from `docker-compose.yaml` and `entrypoint.sh`).

---
## 📋 Prerequisites

Before you begin, ensure you have the following installed:

* Node.js (which includes npm) - Check `package.json` for specific engine requirements if any.
* Angular CLI: `npm install -g @angular/cli`
* Docker (for containerized deployment)

---
## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/TG-Cannabis/cannabis-monitoring-app-v2.git
cd mi-monitoring-app
```

### 2. Install Dependencies

Install the project dependencies using npm:

```bash
npm install
```


### 3. Environment Configuration

The application expects API and WebSocket URLs to be available at runtime.

* **For local development (without Docker):**
    You can modify the `src/app/services/env.service.ts` file directly, although it's designed to pick up values from `window.env`.
    The default values in `env.service.ts` are:
    * `apiUrl: 'http://localhost:8080/api'`
    * `wsUrl: 'http://localhost:8085/ws'`

* **For Dockerized deployment (Recommended for production-like environments):**
    The application uses an `assets/env.template.js` file which is processed by `envsubst` in the `entrypoint.sh` script to create `assets/env.js`.
    The `docker-compose.yaml` file defines `API_URL` and `WS_URL` environment variables that will be injected.
    ```yaml
    services:
      monitoring-app:
        build:
          context: .
          dockerfile: Dockerfile
        ports:
          - "80:80"
        environment:
          - API_URL=${API_URL} # Set this in your .env file or shell
          - WS_URL=${WS_URL}   # Set this in your .env file or shell
    ```
   
    Create a `.env` file in the project root with your backend URLs:
    ```env
    API_URL=http://your-backend-api-url/api
    WS_URL=http://your-backend-websocket-url/ws
    ```
    The `index.html` includes `assets/env.js` to make these URLs available globally.

---
## 💻 Development Server

To start a local development server, run:

```bash
ng serve
```

Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

---
## 📦 Building the Project

To build the project for production, run:

```bash
ng build
```

The build artifacts will be stored in the `dist/mi-monitoring-app/` directory. The production configuration includes optimizations like output hashing and budget checks.
For a development build, you can use:
```bash
ng build --configuration development
```


---
## 🐳 Docker Deployment

This project is configured for Docker deployment using Nginx to serve the Angular application.

### Using Docker Compose

1.  **Ensure you have a `.env` file** in the project root with `API_URL` and `WS_URL` defined as shown in the "Environment Configuration" section.
2.  **Build and run the Docker container:**
    ```bash
    docker-compose up --build
    ```
   
    This command will build the Docker image (if not already built) and start the `monitoring-app` service. The application will be accessible on port 80 of your Docker host (e.g., `http://localhost/mi-monitoring-app/` due to the `baseHref` setting).

    The `entrypoint.sh` script within the Docker container will substitute the `API_URL` and `WS_URL` environment variables into `assets/env.js` before starting Nginx.

---
## 📂 Project Structure

A brief overview of key files and directories:

* `src/`: Contains the main application code.
    * `app/`: Core Angular application modules, components, services, and routes.
        * `core/`: Core singleton services, guards, and layout components (Header, Sidebar, AlertPopup, ToastNotification).
        * `features/`: Feature modules like Dashboard and Monitoring.
        * `layout/`: The main application layout component orchestrating header, sidebar, and content area.
        * `services/`: Application-specific services like `EnvService`.
        * `app.component.ts`: The root Angular component.
        * `app.config.ts`: Application-level configuration for providers (router, HttpClient, animations).
        * `app.routes.ts`: Defines the main application routes.
    * `assets/`: Static assets, including the `env.template.js` for runtime environment configuration.
    * `environments/`: Default environment files (though runtime configuration via `env.js` is preferred for Docker).
    * `index.html`: The main HTML page.
    * `main.ts`: The main entry point for the application, bootstrapping the `AppComponent` and registering Chart.js plugins.
    * `styles.scss`: Global SASS styles.
    * `window-global-fix.ts`: A fix to provide `window.global` for certain dependencies.
* `angular.json`: Angular CLI workspace configuration, including build and serve options.
* `package.json`: Lists project dependencies and npm scripts.
* `tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json`: TypeScript compiler configurations.
* `docker-compose.yaml`: Defines services for Docker deployment.
* `entrypoint.sh`: Script executed when the Docker container starts, used for environment variable substitution.

---
## 🧩 Core Components & Services

* **`MonitoringService`**:
    * Manages WebSocket (STOMP over SockJS) connections to the backend.
    * Handles real-time sensor data and alert subscriptions.
    * Exposes `Observable` streams for sensor data (`sensorData$`) and alerts (`alerts$`).
    * Manages connection state (`ConnectionState`).
    * Triggers UI alerts via `AlertPopupService` and `ToastNotificationService`.
* **`SensorDataService`**:
    * Responsible for fetching historical sensor data from the backend API (`/sensorData`).
    * Allows filtering of data based on sensor type, location, and date range.
    * Fetches available tags (sensor types, locations) for filter dropdowns (`/availableTags`).
* **`PdfReportService`**:
    * Generates PDF reports of the dashboard view.
    * Uses jsPDF and jsPDF-AutoTable to create the document.
    * Includes filters applied, chart images (captured from canvas elements), and optionally, a table of sensor data.
* **`EnvService`**:
    * Provides API and WebSocket URLs to the application. It attempts to read these from a global `window.env` object (populated by `assets/env.js` at runtime) or falls back to default values.
* **`AlertPopupService` & `ToastNotificationService`**:
    * Manage the display of modal alert popups and less intrusive toast notifications, respectively.
* **Layout Components**:
    * `LayoutComponent`: Main structure containing header, sidebar, and the content outlet.
    * `HeaderComponent`: Top navigation bar.
    * `SidebarComponent`: Side navigation menu.

---
This `README.md` was generated with the assistance of an AI tool. Do not be scared of using AI. JM
