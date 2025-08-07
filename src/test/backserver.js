Here's a basic example of how to create a backend server using Node.js and Express.js:

**Step 1: Install Node.js and npm (if you haven't already)**

If you haven't already, download and install Node.js from the official website: <https://nodejs.org/en/download/>

**Step 2: Create a new project folder and navigate into it**

Open your terminal or command prompt and create a new folder for your project:
```
mkdir my-backend-server
cd my-backend-server
```
**Step 3: Initialize a new Node.js project**

Run the following command to initialize a new Node.js project:
```
npm init -y
```
This will create a `package.json` file in your project folder.

**Step 4: Install Express.js**

Run the following command to install Express.js:
```
npm install express
```
**Step 5: Create a new file for your server**

Create a new file called `server.js` in your project folder:
```
touch server.js
```
**Step 6: Write your server code**

Open `server.js` in your favorite code editor and add the following code:
```
const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello from my backend server!');
});

app.listen(3000, () => {
  console.log('Server started on port 3000');
});
```
This code creates an Express.js app, sets up a route for the root URL (`/`) that returns a simple "Hello" message, and starts the server on port 3000.

**Step 7: Start your server**

Run the following command to start your server:
```
node server.js
```
You should see the message "Server started on port 3000" in your terminal.

**Step 8: Test your server**

Open a web browser and navigate to <http://localhost:3000/> to see the "Hello from my backend server!" message.

That's it! You now have a basic backend server up and running using Node.js and Express.js.

Of course, this is just the tip of the iceberg. You can add more routes, middleware, databases, and other features to your server as needed.