# Myapp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.2.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Firebase Configuration

This project uses Firebase for its backend services. To run the application locally, you'll need to connect it to your own Firebase project.

1.  **Create a Firebase Project:** If you don't have one already, create a new project at the [Firebase Console](https://console.firebase.google.com/).
2.  **Set up a Web App:** Within your Firebase project, create a new Web App.
3.  **Get Your Config:** After creating the web app, Firebase will provide you with a configuration object.
4.  **Create `firebase.config.ts`:** In the `src/app/` directory, create a new file named `firebase.config.ts`.
5.  **Copy and Paste:** Copy the contents from `src/app/firebase.config.example.ts` and paste them into your new `firebase.config.ts` file.
6.  **Add Your Credentials:** Replace the placeholder values in `firebase.config.ts` with the actual configuration values from your Firebase project.

Your `firebase.config.ts` file is ignored by Git (see `.gitignore`) and will not be committed to the repository. This keeps your project credentials secure.


## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
