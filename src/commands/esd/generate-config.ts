import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError, } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { QueryResult } from 'jsforce';
const url = require('url');
const fs = require('fs');
const YAML = require('yaml');
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('esd-generate-config', 'esd');
const puppeteer = require('puppeteer');

interface ButtonAndDeployment {
  deploymentName: string
  buttonName: string
  jsParameterName: string
  webAppUrl: string
}

interface IdAndName {
  Id: string
  DeveloperName: string
  FullName: string
}

interface StaticResource {

  Body: string
  ContentType: string
  CacheControl: string
  Name: string
  Id: string
}

export default class GenerateConfig extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    ``
  ];

  public static args = [{ name: 'file' }];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    configfile: flags.string({ char: 'c', description: messages.getMessage('configFlagDescription'), required: true }),
    staticresourcename: flags.string({ char: 's', description: messages.getMessage('staticresourcenameFlagDescription'), required: false }),
    debug: flags.boolean({ char: 'v', description: messages.getMessage('verboseFlagDescription') }),

  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run(): Promise<AnyJson> {

    //let replaceConfigs: any[] = JSON.parse(fs.readFileSync(this.flags.replaceconfig, { encoding: 'utf8', flag: 'r' }));
    if (!fs.existsSync(this.flags.configfile)) {
      this.ux.error(`${this.flags.configfile} does not exist.`)
      // Return an object to be displayed with --json
      return { 'status': 'failed' };
    }
    else {

      let buttonsAndDeployments: ButtonAndDeployment[] = YAML.parse(fs.readFileSync(this.flags.configfile, { encoding: 'utf8', flag: 'r' }));

      let finalJsString = [];
      for (let deployName in buttonsAndDeployments) {
        let btnDeployment: ButtonAndDeployment = buttonsAndDeployments[deployName];
        let jsString = await this.getJsStringForButtonDeployment(btnDeployment);
        finalJsString.push(jsString);
      }
      const conn = this.org.getConnection();
      const finalStaticResourceJs = finalJsString.join('\n');

      if(this.flags.staticresourcename){
        let result:QueryResult<any>= await conn.tooling.query(`select Id,Name from StaticResource where Name='${this.flags.staticresourcename}'`)
      
        let sRes: StaticResource = {
          Body: Buffer.from(finalStaticResourceJs, 'binary').toString('base64'),
          ContentType: 'text/javascript',
          CacheControl: 'public',
          Name: this.flags.staticresourcename,
          Id:null
        }
        let sResUpdate:any;
        if(result.totalSize == 1){
          sRes.Id=result.records[0].Id;
          sResUpdate = await conn.tooling.update('StaticResource', sRes)
        }else{
          sResUpdate = await conn.tooling.create('StaticResource', sRes)
        }
        
        return {
          "Id": sResUpdate.id
        }
      }else{
        console.log(`========= STATIC RESOURCE JS ================\n ${finalStaticResourceJs}`);
        return {
          "status": "JS printed on console"
        }
      }
      
    }
  }

  private async getJsStringForButtonDeployment(btnDeployment: ButtonAndDeployment) {
    const conn = this.org.getConnection();


    let result = await conn.query<IdAndName>(`SELECT Id FROM Site`);
    if (!result.records || result.records.length <= 0) {
      throw new SfdxError(messages.getMessage('errorNoSiteResults', [this.flags.esdname]));
    }
    let siteId = result.records[0].Id;

    let siteDetails = await conn.query<any>(`SELECT SecureUrl FROM SiteDetail where DurableId='${siteId}'`);
    if (!siteDetails.records || siteDetails.records.length <= 0) {
      throw new SfdxError(messages.getMessage('errorNoSiteDetailResults', [this.flags.esdname]));
    }

    let secureUrl = siteDetails.records[0].SecureUrl;

    result = await conn.tooling.query<IdAndName>(`select Id,DeveloperName from EmbeddedServiceConfig where DeveloperName = '${btnDeployment.deploymentName}'`);
    // Organization will always return one result, but this is an example of throwing an error
    // The output and --json will automatically be handled for you.
    if (!result.records || result.records.length <= 0) {
      throw new SfdxError(messages.getMessage('errorNoEsdResults', [this.flags.esdname]));
    }
    const esdConfigId = result.records[0].Id.substring(0,15);

    result = await conn.tooling.query<IdAndName>(`select Id,FullName from EmbeddedServiceLiveAgent where EmbeddedServiceConfigId='${esdConfigId}'`);
    if (!result.records || result.records.length <= 0) {
      throw new SfdxError(messages.getMessage('errorNoEsdLAResults', [this.flags.esdname]));
    }

    const esdFullName = result.records[0].FullName;
    if (this.flags.debug) this.ux.log(`[${btnDeployment.deploymentName}:${btnDeployment.buttonName}] - Fetched deployment full nanme: ${esdFullName}`);

    result = await conn.query<IdAndName>(`SELECT DeveloperName,Id  FROM LiveChatDeployment where DeveloperName='${btnDeployment.buttonName}'`);
    if (!result.records || result.records.length <= 0) {
      throw new SfdxError(messages.getMessage('errorNoEsdLAResults', [this.flags.esdname]));
    }
    const deploymentId = result.records[0].Id.substring(0,15);;
    if (this.flags.debug) this.ux.log(`[${btnDeployment.deploymentName}:${btnDeployment.buttonName}] - Fetched deployment id: ${deploymentId}`);
    result = await conn.query<IdAndName>(`SELECT DeveloperName,Id  FROM LiveChatButton where DeveloperName='${btnDeployment.buttonName}'`);
    if (!result.records || result.records.length <= 0) {
      throw new SfdxError(messages.getMessage('errorNoEsdLAResults', [this.flags.esdname]));
    }

    const buttonId = result.records[0].Id.substring(0,15);;
    if (this.flags.debug) this.ux.log(`[${btnDeployment.deploymentName}:${btnDeployment.buttonName}] - Fetched button Id : ${buttonId}`);

    const chatEndpointUrls = await this.getLiveAgentEndpointUrl();

    
    const jsString = `window.${btnDeployment.jsParameterName}={
        "instanceUrl": '${conn.instanceUrl}',
        "pageUrl" : '${secureUrl}',
        "orgId": '${this.org.getOrgId().substring(0,15)}',
        "botName": '${btnDeployment.deploymentName}',
        "chatParameters": {
            "baseLiveAgentContentURL": '${chatEndpointUrls.contentUrl}',
            "deploymentId": '${deploymentId}',
            "buttonId": '${buttonId}',
            "baseLiveAgentURL": '${chatEndpointUrls.contentUrl}',
            "eswLiveAgentDevName": '${esdFullName}',
            "isOfflineSupportEnabled": false
        }  
      };`;
    if (this.flags.debug) this.ux.log(`[${btnDeployment.deploymentName}:${btnDeployment.buttonName}] - Generated JS : ${jsString}`);

    return jsString;
  }

  private async getLiveAgentEndpointUrl() {


    const conn = this.org.getConnection();
    let liveAgentUrls = await conn.tooling.query<any>(`select LiveAgentContentUrl,LiveAgentChatUrl from EmbeddedServiceLiveAgent limit 1`);
    
    if (!liveAgentUrls.records || liveAgentUrls.records.length <= 0) {
      throw new SfdxError(messages.getMessage('errorNoEsdLARecords'));
    }

    return {
      "chatUrl":liveAgentUrls.records[0].LiveAgentChatUrl,
      "contentUrl":liveAgentUrls.records[0].LiveAgentContentUrl
    }

  }

}
