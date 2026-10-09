// Fictional exercise data. These records never enter the public-source event picture.
export const exerciseDomains=[
  {name:'OSINT and social signals',sources:['Public social posts and hashtags','Geofenced social or bystander media','Public protest announcements','Local media and transit notices']},
  {name:'Deep and dark web',sources:['Underground forum monitoring','Authorized channel monitoring','Leak and paste monitoring']},
  {name:'Law enforcement and public safety',sources:['Fusion-center or FBI partner bulletin','CISA or ISAC advisory','Jurisdictional CAD and historical incident data']},
  {name:'Venue operations',sources:['PACS badge events','VMS visitor and delivery records','On-site security dispatch']},
  {name:'Cyber and infrastructure',sources:['STIX/TAXII threat intelligence','Passive DNS and attack-surface inventory','Venue firewall, NetFlow and SIEM']},
  {name:'Geospatial and environment',sources:['GIS routes, facilities and work zones','FAA and authorized C-UAS telemetry','NWS and USGS hazards']}
];

const observations=[
  {id:'S-01',minute:0,domain:0,source:'Public social post',summary:'Fictional public rally announcement names a plaza near the venue; attendance and intent unverified.',entity:'plaza',reliability:'unverified public claim'},
  {id:'S-02',minute:1,domain:0,source:'Geofenced social media',summary:'Synthetic bystander image suggests a small gathering; location and capture time unverified.',entity:'plaza',reliability:'unverified media'},
  {id:'S-03',minute:2,domain:0,source:'Activist public calendar',summary:'Fictional peaceful demonstration listing; no violent intent stated.',entity:'plaza',reliability:'public listing'},
  {id:'S-04',minute:3,domain:0,source:'Local media and transit',summary:'Synthetic transit delay notice near the event; route impact unconfirmed.',entity:'route',reliability:'exercise publisher'},
  {id:'S-05',minute:4,domain:1,source:'Authorized underground-monitoring feed',summary:'Fictional forum reference to the event; authorship, intent and credibility unknown.',entity:'event',reliability:'unverified claim'},
  {id:'S-06',minute:5,domain:1,source:'Authorized channel-monitoring feed',summary:'Fictional message repeats a rumor about a protected guest; no independent confirmation.',entity:'VIP-01',reliability:'unverified rumor'},
  {id:'S-07',minute:6,domain:1,source:'Leak-monitoring feed',summary:'Synthetic paste claims to contain a guest list; authenticity and exposure unverified.',entity:'VIP-01',reliability:'unverified claim'},
  {id:'S-08',minute:7,domain:2,source:'Fusion-center partner bulletin',summary:'Fictional exercise bulletin requests verification of event-related online claims.',entity:'event',reliability:'exercise partner bulletin'},
  {id:'S-09',minute:8,domain:2,source:'CISA or ISAC advisory',summary:'Synthetic sector advisory describes generic event-service disruption; venue applicability unknown.',entity:'cyber',reliability:'exercise advisory'},
  {id:'S-10',minute:9,domain:2,source:'Jurisdictional CAD',summary:'Synthetic public-safety call count rises in the area; incidents and relevance unverified.',entity:'plaza',reliability:'exercise aggregate'},
  {id:'S-11',minute:10,domain:3,source:'PACS badge event',summary:'Synthetic denied badge at a loading entrance; identity and cause require operator review.',entity:'loading',reliability:'exercise internal log'},
  {id:'S-12',minute:11,domain:3,source:'VMS delivery record',summary:'Synthetic delivery references role token VIP-01; authorization requires human verification.',entity:'VIP-01',reliability:'exercise internal log'},
  {id:'S-13',minute:12,domain:3,source:'Security dispatch',summary:'Synthetic report of an unattended bag; disposition pending on-site team review.',entity:'plaza',reliability:'exercise internal log'},
  {id:'S-14',minute:13,domain:4,source:'STIX/TAXII CTI',summary:'Fictional campaign claim targets event ticketing; no verified activity attribution.',entity:'cyber',reliability:'exercise CTI claim'},
  {id:'S-15',minute:14,domain:4,source:'Passive DNS and ASM',summary:'Synthetic lookalike domain observed; ownership and malicious use unverified.',entity:'cyber',reliability:'exercise telemetry'},
  {id:'S-16',minute:15,domain:4,source:'Venue SIEM and NetFlow',summary:'Synthetic traffic-volume anomaly at a ticketing gateway; service impact unconfirmed.',entity:'cyber',reliability:'exercise internal telemetry'},
  {id:'S-17',minute:16,domain:5,source:'GIS and road agency',summary:'Synthetic closure intersects a proposed ingress route; operator route plan unverified.',entity:'route',reliability:'exercise agency data'},
  {id:'S-18',minute:17,domain:5,source:'FAA and authorized C-UAS',summary:'Synthetic sensor track near the exercise airspace; aircraft identity and violation unverified.',entity:'airspace',reliability:'exercise sensor report'},
  {id:'S-19',minute:18,domain:5,source:'NWS and USGS',summary:'Synthetic severe-weather alert overlaps the exercise window; local impact unverified.',entity:'weather',reliability:'exercise agency alert'}
];

const correlations=[
  {id:'C-01',title:'Public gathering and denied access',evidence:['S-01','S-11'],state:'correlation candidate',basis:'A public gathering and a denied badge occur in the same exercise window. The records do not identify the same people or establish a perimeter breach.',next:'Confirm badge disposition and gathering location with venue security.'},
  {id:'C-02',title:'Guest rumor and delivery record',evidence:['S-06','S-12'],state:'protective review candidate',basis:'A rumor and a delivery record share only the fictional role token VIP-01. No identity, targeting or hostile intent is established.',next:'Verify the delivery through the approved VMS and protective detail; do not disclose personal details.'},
  {id:'C-03',title:'Campaign claim and gateway anomaly',evidence:['S-14','S-16'],state:'cyber review candidate',basis:'A campaign claim and traffic anomaly overlap in time. Neither confirms actor attribution, compromise or service impact.',next:'Check gateway baselines and ticketing health with the service owner.'},
  {id:'C-04',title:'Route and weather contingency',evidence:['S-17','S-19'],state:'operations review candidate',basis:'A simulated road closure and weather alert may affect the same exercise period; the event route plan is unverified.',next:'Validate closure window, forecast footprint and approved alternate route.'},
  {id:'C-05',title:'Airspace observation',evidence:['S-18'],state:'aviation review candidate',basis:'A simulated sensor track is an observation only. FAA airspace data does not identify the aircraft or prove a violation.',next:'Refer to authorized aviation personnel and verify current NOTAM and sensor data.'}
];

export const exerciseStages=[
  {label:'Baseline',minute:9},
  {label:'Operations',minute:12},
  {label:'Cyber and routes',minute:16},
  {label:'Full exercise picture',minute:18}
];

export function buildExerciseBrief(stage=3){
  if(!Number.isInteger(stage)||stage<0||stage>=exerciseStages.length)throw Error('Unknown exercise stage');
  const step=exerciseStages[stage],visible=observations.filter(item=>item.minute<=step.minute);
  const ids=new Set(visible.map(item=>item.id));
  return {kind:'simulated_training_exercise',clock:`T+${String(step.minute).padStart(2,'0')} min`,stage:step.label,observations:visible,correlations:correlations.filter(item=>item.evidence.every(id=>ids.has(id))),domains:exerciseDomains.map((domain,index)=>({...domain,count:visible.filter(item=>item.domain===index).length})),assessment:{severity:'not_assessed',confidence:'not_assessed',model:'No AI model invoked; deterministic evidence-link demonstration'},limitations:['All exercise observations are fictional. No real person, incident, camera, drone or cyber event is represented.','Shared time, location or role token is a review lead, not proof of causation or malicious intent.','Human analysts must verify source authenticity, legal authority, identity and operational impact before any finding.']};
}
