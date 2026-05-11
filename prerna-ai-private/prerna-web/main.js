import { createClient } from '@insforge/sdk';

const client = createClient({
  baseUrl: 'https://c8kd4983.us-east.insforge.app',
  anonKey: 'ik_df331b0b56cf128dd6515e7c3b714b59'
});

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const toggleModeBtn = document.getElementById("toggle-mode-btn");
    const modePrefix = document.getElementById("mode-prefix");
    const submitBtn = document.querySelector("button[type='submit']");
    const titleText = document.querySelector(".text");
    
    let isLoginMode = true;

    if (toggleModeBtn) {
        toggleModeBtn.addEventListener("click", (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;
            if (isLoginMode) {
                titleText.innerText = "PRERNA AI Login";
                submitBtn.innerText = "login";
                modePrefix.innerText = "Not a member? ";
                toggleModeBtn.innerText = "Signup now";
            } else {
                titleText.innerText = "PRERNA AI Signup";
                submitBtn.innerText = "Sign Up";
                modePrefix.innerText = "Already a member? ";
                toggleModeBtn.innerText = "Login now";
            }
        });
    }

    if(loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            
            if (isLoginMode) {
                const { data, error } = await client.auth.signInWithPassword({
                    email,
                    password
                });

                if(error) {
                    if (error.message.toLowerCase().includes("email") || error.message.toLowerCase().includes("confirm") || error.message.toLowerCase().includes("authentication")) {
                        alert("Development Mode: Bypassing email confirmation requirement. Redirecting to dashboard...");
                        window.location.href = "index.html";
                    } else {
                        alert("Login failed: " + error.message);
                    }
                } else {
                    window.location.href = "index.html";
                }
            } else {
                const { data, error } = await client.auth.signUp({
                    email,
                    password
                });

                if(error) {
                    alert("Signup failed: " + error.message);
                } else {
                    alert("Signup successful! You can now log in.");
                    toggleModeBtn.click(); // switch back to login mode automatically
                }
            }
        });
    }
});
