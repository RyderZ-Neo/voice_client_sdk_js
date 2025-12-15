import { PipecatClient, RTVIEvent } from '@pipecat-ai/client-js';
import {
  AVAILABLE_TRANSPORTS,
  DEFAULT_TRANSPORT,
  TRANSPORT_CONFIG,
  createTransport,
} from './config';

class VoiceChatClient {
  constructor() {
    this.client = null;
    this.transportType = DEFAULT_TRANSPORT;
    this.isConnected = false;
    this.userInfo = null; // Store user info

    this.setupDOM();
    this.setupEventListeners();
    this.addEvent('initialized', 'Client initialized');
  }

  setupDOM() {
    this.transportSelect = document.getElementById('transport-select');
    this.connectBtn = document.getElementById('connect-btn');
    this.micBtn = document.getElementById('mic-btn');
    this.micStatus = document.getElementById('mic-status');
    this.pauseBtn = document.getElementById('pause-btn');
    this.resumeBtn = document.getElementById('resume-btn');
    this.conversationLog = document.getElementById('conversation-log');
    this.eventsLog = document.getElementById('events-log');
    
    // User info form elements
    this.userInfoForm = document.getElementById('user-info-form');
    this.userName = document.getElementById('user-name');
    this.userEmail = document.getElementById('user-email');
    this.startBtn = document.getElementById('start-btn');


    // Populate transport selector
    this.transportSelect.innerHTML = '';
    AVAILABLE_TRANSPORTS.forEach((transport) => {
      const option = document.createElement('option');
      option.value = transport;
      option.textContent = transport.charAt(0).toUpperCase() + transport.slice(1);
      if (transport === 'smallwebrtc') {
        option.textContent = 'SmallWebRTC';
      } else if (transport === 'daily') {
        option.textContent = 'Daily';
      }
      
      if (transport === DEFAULT_TRANSPORT) {
        option.selected = true;
      }
      
      this.transportSelect.appendChild(option);
    });

    if (AVAILABLE_TRANSPORTS.length === 1) {
      this.transportSelect.parentElement.style.display = 'none';
    }

    this.addConversationMessage(
      'Press Connect to start the interview. Your details are necessary for our team to reach out to you.',
      'placeholder'
    );
  }

  setupEventListeners() {
    this.transportSelect.addEventListener('change', (e) => {
      this.transportType = e.target.value;
      this.addEvent('transport-changed', this.transportType);
    });

    // Handle user info form submission
    this.startBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      const name = this.userName.value.trim();
      const email = this.userEmail.value.trim();
      
      if (!name || !email) {
        alert('Please enter both name and email');
        return;
      }
      
      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Please enter a valid email address');
        return;
      }
      
      this.userInfo = { name, email };
      this.hideUserForm();
      this.connect();
    });

    this.connectBtn.addEventListener('click', () => {
      if (this.isConnected) {
        this.disconnect();
      } else {
        this.showUserForm();
      }
    });

    this.micBtn.addEventListener('click', () => {
      if (this.client) {
        const newState = !this.client.isMicEnabled;
        this.client.enableMic(newState);
        this.updateMicButton(newState);
      }
    });

    this.pauseBtn.addEventListener('click', () => {
      if (this.isConnected && this.client) {
        this.client.enableMic(false);
        this.updateMicButton(false);
        // ✅ Fixed: Pass single message object
       this.client.sendClientMessage('set-action', { action: 'pause' });
        this.pauseBtn.disabled = true;
        this.resumeBtn.disabled = false;
        this.addEvent('pause', 'Conversation paused');
      }
    });

    this.resumeBtn.addEventListener('click', () => {
      if (this.isConnected && this.client) {
        this.client.enableMic(true);
        this.updateMicButton(true);
        // ✅ Fixed: Pass single message object
       this.client.sendClientMessage('set-action', { action: 'resume' });
        this.resumeBtn.disabled = true;
        this.pauseBtn.disabled = false;
        this.addEvent('resume', 'Conversation resumed');
      }
});
  }

  showUserForm() {
    this.userInfoForm.style.display = 'block';
    this.connectBtn.style.display = 'none';
  }

  hideUserForm() {
    this.userInfoForm.style.display = 'none';
    this.connectBtn.style.display = 'block';
  }

  async connect() {
    try {
      this.addEvent('connecting', `Using ${this.transportType} transport`);

      // Create transport with user info in request body
      const transport = await createTransport(this.transportType, this.userInfo);

      this.client = new PipecatClient({
        transport,
        enableMic: true,
        enableCam: false,
        callbacks: {
          onConnected: () => {
            this.onConnected();
          },
          onDisconnected: () => {
            this.onDisconnected();
          },
          onTransportStateChanged: (state) => {
            this.addEvent('transport-state', state);
          },
          onBotReady: () => {
            this.addEvent('bot-ready', 'Bot is ready to talk');
          },
          onError: (error) => {
            this.addEvent('error', error.message);
          },
          onUserTranscript: (data) => {
            if (data.final) {
              this.addConversationMessage(data.text, 'user');
            }
          },
          // onBotTranscript: (data) => {
          //   this.addConversationMessage(data.text, 'bot');
          // },
        },
      });

      this.setupAudio();

      this.client.on(RTVIEvent.ServerMessage, (data) => {
        // console.log('[RTVI] ServerMessage received:', data);
        
        // if (data.type === 'user_turn_complete' && data.transcriptions) {
        //   data.transcriptions.forEach((transcription) => {
        //     this.addConversationMessage(transcription.text, 'user');
        //   });
        // }
        if(data.type === 'interview_progress') {
          console.log(`📊 Interview progress: ${data.progress_percent}%`); 
        }

        if (data.type === 'bot_transcript' && data.transcriptions) {
          data.transcriptions.forEach((transcription) => {
            this.addConversationMessage(transcription.text, 'bot');
          });          
        }
        // ✅ Handle interview completion
        if (data.type === 'interview_complete') {
          this.addEvent('interview-complete', data.message || 'Interview completed');
          // this.addConversationMessage(
          //   'Thank you! The interview is now complete. Disconnecting...',
          //   'bot'
          // );
          // Disconnect after a short delay to let final messages display
          setTimeout(() => {
            this.disconnect();
            // ✅ Show final message AFTER disconnect

          }, 
          2000);
 
        }
      });
      
      // const connectParams = {
      //   ...TRANSPORT_CONFIG[this.transportType],
      //   requestData: this.userInfo // Pass user info here
      // };
      
      await this.client.connect(); // Use client.connect() without params
    } catch (error) {
      this.addEvent('error', error.message);
      console.error('Connection error:', error);
      this.showUserForm(); // Show form again on error
    }
  }
  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
    }
  }


  setupAudio() {
    this.client.on(RTVIEvent.TrackStarted, (track, participant) => {
      if (!participant?.local && track.kind === 'audio') {
        this.addEvent('track-started', 'Bot audio track');
        const audio = document.createElement('audio');
        audio.autoplay = true;
        audio.srcObject = new MediaStream([track]);
        document.body.appendChild(audio);
      }
    });
  }

  onConnected() {
    this.isConnected = true;
    this.connectBtn.textContent = 'Disconnect';
    this.connectBtn.classList.add('disconnect');
    this.micBtn.disabled = false;
    this.pauseBtn.disabled = false;
    this.resumeBtn.disabled = true;
    this.transportSelect.disabled = true;
    this.updateMicButton(this.client.isMicEnabled);
    this.addEvent('connected', 'Successfully connected to bot');

    // Clear placeholder
    if (this.conversationLog.querySelector('.placeholder')) {
      this.conversationLog.innerHTML = '';
    }
  }
  onDisconnected() {
    this.isConnected = false;
    this.connectBtn.textContent = 'Connect';
    this.connectBtn.classList.remove('disconnect');
    this.micBtn.disabled = true;
    this.pauseBtn.disabled = true;
    this.resumeBtn.disabled = true;
    this.transportSelect.disabled = false;
    this.updateMicButton(false);
    this.addEvent('disconnected', 'Disconnected from bot');
    this.addConversationMessage(
              'Disconnected. We will be in touch via email soon!',
              'placeholder'
            );
    
    // Reset user info so they can enter new details next time
    this.userInfo = null;
  }


  updateMicButton(enabled) {
    this.micStatus.textContent = enabled ? 'Mic is On' : 'Mic is Off';
    this.micBtn.style.backgroundColor = enabled ? '#10b981' : '#1f2937';
  }

  addConversationMessage(text, role) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `conversation-message ${role}`;

    if (role === 'placeholder') {
      messageDiv.textContent = text;
    } else {
      const roleSpan = document.createElement('div');
      roleSpan.className = 'role';
      roleSpan.textContent = role === 'user' ? 'You' : 'Bot';

      const textDiv = document.createElement('div');
      textDiv.textContent = text;

      messageDiv.appendChild(roleSpan);
      messageDiv.appendChild(textDiv);
    }

    this.conversationLog.appendChild(messageDiv);
    this.conversationLog.scrollTop = this.conversationLog.scrollHeight;
  }

  addEvent(eventName, data) {
    const eventDiv = document.createElement('div');
    eventDiv.className = 'event-entry';

    const timestamp = new Date().toLocaleTimeString();
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'timestamp';
    timestampSpan.textContent = timestamp;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'event-name';
    nameSpan.textContent = eventName;

    const dataSpan = document.createElement('span');
    dataSpan.className = 'event-data';
    dataSpan.textContent =
      typeof data === 'string' ? data : JSON.stringify(data);

    eventDiv.appendChild(timestampSpan);
    eventDiv.appendChild(nameSpan);
    eventDiv.appendChild(dataSpan);

    this.eventsLog.appendChild(eventDiv);
    this.eventsLog.scrollTop = this.eventsLog.scrollHeight;
  }
}

// Initialize when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  new VoiceChatClient();
});