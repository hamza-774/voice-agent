{% comment %} Voice Assistant Widget - Step 1 {% endcomment %}
<div id="voice-assistant-root" style="position: fixed; bottom: 20px; right: 20px; z-index: 9999; font-family: system-ui;">
  
  <!-- Chat Panel (hidden by default) -->
  <div id="va-panel" style="display: none; width: 320px; background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); overflow: hidden; margin-bottom: 12px;">
    <div style="padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-weight: 600;">
      🎤 Voice Assistant
      <button id="va-close" style="float: right; background: none; border: none; color: white; font-size: 20px; cursor: pointer;">&times;</button>
    </div>
    <div id="va-messages" style="max-height: 300px; overflow-y: auto; padding: 12px; font-size: 14px; line-height: 1.4;"></div>
    <div style="padding: 12px; border-top: 1px solid #eee; display: flex; gap: 8px;">
      <button id="va-mic" style="flex: 1; padding: 10px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">🎤 Hold to Speak</button>
    </div>
  </div>

  <!-- Floating Toggle Button -->
  <button id="va-toggle" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; color: white; font-size: 24px; cursor: pointer; box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4); transition: transform 0.2s;">
    🎤
  </button>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
  const root = document.getElementById('voice-assistant-root');
  const panel = document.getElementById('va-panel');
  const toggle = document.getElementById('va-toggle');
  const closeBtn = document.getElementById('va-close');
  const micBtn = document.getElementById('va-mic');
  const messagesDiv = document.getElementById('va-messages');

  // Toggle panel
  toggle.onclick = () => panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  closeBtn.onclick = () => panel.style.display = 'none';

  // Add message to chat
  function addMessage(text, isUser = false) {
    const msg = document.createElement('div');
    msg.style.cssText = `padding: 10px 14px; margin: 8px 0; border-radius: 12px; background: ${isUser ? '#667eea' : '#f1f1f1'}; color: ${isUser ? 'white' : '#333'}; align-self: ${isUser ? 'flex-end' : 'flex-start'};`;
    msg.textContent = text;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // Web Speech API setup (Chrome/Safari/Edge)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;
  const synth = window.speechSynthesis;

  if (recognition) {
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    let isListening = false;

    micBtn.onmousedown = () => {
      if (!isListening) {
        try {
          recognition.start();
          micBtn.textContent = '🔴 Listening...';
          micBtn.style.background = '#e53e3e';
          isListening = true;
          addMessage("Listening... Tap mic when done.", true);
        } catch(e) {
          console.log('Speech recognition error:', e);
          addMessage("Mic error — try clicking once instead of holding.", false);
        }
      }
    };
    
    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      addMessage(`You: ${transcript}`, true);
      
      // Show loading state
      micBtn.textContent = '⏳ Thinking...';
      micBtn.style.background = '#9ca3af';
      
      try {
        // 🔗 FIXED: Using /api/voice because Vercel Root Directory is now set to 'voice-agent'
        const VERCEL_URL = 'https://voice-agent-virid-one.vercel.app';
        
        const response = await fetch(`${VERCEL_URL}/api/voice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: transcript })
        });
        
        const data = await response.json();
        
        // Handle API errors
        if (data.error) {
          addMessage(`Assistant: ${data.message || data.error}`, false);
          speak("Sorry, I'm having trouble. Please try again.");
        } else {
          // Show AI reply
          addMessage(`Assistant: ${data.reply}`, false);
          speak(data.reply);
          
          // 🎯 Execute AI actions
          if (data.action === 'navigate' && data.url) {
            setTimeout(() => {
              window.location.href = data.url;
            }, 1500); // Wait for voice to finish speaking
          }
        }
        
      } catch (error) {
        console.error('AI fetch failed:', error);
        addMessage('Assistant: Connection error. Check console.', false);
      }
      
      // Reset mic button
      micBtn.textContent = '🎤 Hold to Speak';
      micBtn.style.background = '#667eea';
      isListening = false;
    };

    recognition.onerror = (event) => {
      console.error('Speech error:', event.error);
      addMessage("Mic error — please allow microphone access.", false);
      micBtn.textContent = '🎤 Hold to Speak';
      micBtn.style.background = '#667eea';
      isListening = false;
    };
  } else {
    micBtn.disabled = true;
    micBtn.textContent = '🎤 Not Supported';
    addMessage("Voice not supported in this browser. Try Chrome.", false);
  }

  // Speak text aloud
  function speak(text) {
    if (synth.speaking) synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // Slightly slower for clarity
    synth.speak(utterance);
  }

  // Welcome message
  setTimeout(() => {
    addMessage("👋 Hi! I'm your voice shopping assistant. Click the mic and ask me anything about Hush Puppies!");
    speak("Hi! I'm your voice shopping assistant. Ask me about shoes, sizes, or trending products.");
  }, 500);
});
</script>
