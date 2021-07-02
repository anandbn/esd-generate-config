esd-generate-config
===================

A typical embedded service deployment generate a JavaScript like below:

```
<style type='text/css'>
	.embeddedServiceHelpButton .helpButton .uiButton {
		background-color: #005290;
		font-family: "Arial", sans-serif;
	}
	.embeddedServiceHelpButton .helpButton .uiButton:focus {
		outline: 1px solid #005290;
	}
</style>

<script type='text/javascript' src='https://service.force.com/embeddedservice/5.0/esw.min.js'></script>
<script type='text/javascript'>
	var initESW = function(gslbBaseURL) {
		embedded_svc.settings.displayHelpButton = true; //Or false
		embedded_svc.settings.language = ''; //For example, enter 'en' or 'en-US'

		//embedded_svc.settings.defaultMinimizedText = '...'; //(Defaults to Chat with an Expert)
		//embedded_svc.settings.disabledMinimizedText = '...'; //(Defaults to Agent Offline)

		//embedded_svc.settings.loadingText = ''; //(Defaults to Loading)
		//embedded_svc.settings.storageDomain = 'yourdomain.com'; //(Sets the domain for your deployment so that visitors can navigate subdomains during a chat session)

		// Settings for Chat
		//embedded_svc.settings.directToButtonRouting = function(prechatFormData) {
			// Dynamically changes the button ID based on what the visitor enters in the pre-chat form.
			// Returns a valid button ID.
		//};
		//embedded_svc.settings.prepopulatedPrechatFields = {}; //Sets the auto-population of pre-chat form fields
		//embedded_svc.settings.fallbackRouting = []; //An array of button IDs, user IDs, or userId_buttonId
		//embedded_svc.settings.offlineSupportMinimizedText = '...'; //(Defaults to Contact Us)

		embedded_svc.settings.enabledFeatures = ['LiveAgent'];
		embedded_svc.settings.entryFeature = 'LiveAgent';

		embedded_svc.init(
			'https://yourdomain.my.salesforce.com',
			'https://yourdomain.cs167.force.com',
			gslbBaseURL,
			'00D6u0000008fx7',
			'Deployment_Name',
			{
				baseLiveAgentContentURL: 'https://c.la4-c1cs-ia5.salesforceliveagent.com/content',
				deploymentId: '5721900000001At',
				buttonId: '5731900000001EM',
				baseLiveAgentURL: 'https://d.la4-c1cs-ia5.salesforceliveagent.com/chat',
				eswLiveAgentDevName: 'EmbeddedServiceLiveAgent_Parent04I17000000CbJGEA0_179ce026705',
				isOfflineSupportEnabled: false
			}
		);
	};

	if (!window.embedded_svc) {
		var s = document.createElement('script');
		s.setAttribute('src', 'https://yourdomain.my.salesforce.com/embeddedservice/5.0/esw.min.js');
		s.onload = function() {
			initESW(null);
		};
		document.body.appendChild(s);
	} else {
		initESW('https://service.force.com');
	}
</script>

```

Many of these parameters change when you move from one sandbox to another or if you refresh a sandbox.  In order for the web applications to not be tighly coupled to these varyin parameters, one option is to store the varying values in a `Static Resource` and refer to that static resource and the variables in the JavaScript code. The Static resource would looke like below:

```
window.LIVECHAT_PARAMETERS = {
    "instanceUrl": 'https://yourdomain.my.salesforce.com',
    "pageUrl" : 'https://yourdomain.cs68.force.com',
    "orgId": '00D1D000000UDuO',
    "botName": 'Chat_VA_Application',
    "chatParameters": {
        "baseLiveAgentContentURL": 'https://c.la4-c1cs-phx.salesforceliveagent.com/content',
        "deploymentId": '5721D000000Ci8r',
	    "buttonId": '5731D000000Cj1v',
        "baseLiveAgentURL": 'https://d.la4-c1cs-phx.salesforceliveagent.com/chat',
         "eswLiveAgentDevName": 'EmbeddedServiceLiveAgent_Parent04I17000000CbJLEA0_179ce035dd0',
         "isOfflineSupportEnabled": false
    }  
}

```

Now the web application can simple refer to the above static resource and then use `LIVECHAT_PARAMTERS.orgId` in the respective code snippet. This limits the number of changes to the JavaScript code and makes it more loosely coupled.

THis SFDX plugin will generate the static resource for 1 or more buttons automatically based on the depployment name and button name. 

### Usage

```
sfdx esd:generate-config -c <config YAML location> -s <static resource name to create/update> [-v] -u <user alias>

```

The following are the parameters:
- `-c` or `--configfile` : The YAML file that will used to determine the deployment names, button names, webapp url etc.
- `-s` or `--staticresourcename` : Name for the static resource that will be updated or created in the org
= `-v` or `--debug` : A boolean flag to toggle  detailed logging by the plugin


### YAML Format

The configuration YAML file will have the following format:

```
<button_deployment_name>:
  deploymentName: <Embedded Service Deployment Name>
  buttonName: <Live Agent Button Name associated with the Deployment>
  jsParameterName: <Name of the JS Global variable to inject the parameters>
  webAppUrl: <value for the `pageUrl` value in the JS snippet>
```

#### YAML Example

```
ask_astro:
  deploymentName: "Chat_VA_Application"
  buttonName: "Virtual_Assistant_Application"
  jsParameterName: "LIVECHAT_PARAMETERS_EDGE"
  webAppUrl: "http://www.salesforce.com"

```