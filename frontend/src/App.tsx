import { useState, useEffect, useRef } from 'react'
import Visualizer from './components/Visualizer'
import './App.css'

function App() {
  const [data, setData] = useState({ nodes: [], links: [] })

  useEffect(() => {
    // Avoid re-connecting if already connected (React strict mode runs twice)
    console.log("Setting up WebSocket connection...");

    // Explicitly using 127.0.0.1
    const socket = new WebSocket('ws://127.0.0.1:8000/ws');

    socket.onopen = () => {
      console.log('Connected to WebSocket');
    };

    socket.onmessage = (event) => {
      console.log('Received message:', event.data);
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'update') {
          setData(message.data);
        }
      } catch (e) {
        console.error("Error processing message", e);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };

    socket.onclose = (event) => {
      console.log("WebSocket Closed:", event);
    }

    return () => {
      console.log("Component unmounting, closing socket.");
      socket.close();
    };
  }, []);

  return (
    <div className="App">
      <Visualizer data={data} />
    </div>
  )
}

export default App
