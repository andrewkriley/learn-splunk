🧪 I started with a simple goal: learn Splunk data onboarding properly.

Not just “click around Splunk Web and hope it makes sense” learning. I wanted a practical lab where I could see the full journey from data source to searchable event.

So I built a local Docker-based Learn Splunk lab.

It started as a basic setup: Splunk Enterprise, Deployment Server, Heavy Forwarder, Universal Forwarder, some sample logs, and a few lessons.

Then, as usual, the scope grew legs.

The lab now has:

✅ Direct `UF -> Indexer` forwarding  
✅ `UF -> HF -> Indexer` forwarding  
✅ File, TCP, UDP, JSON, XML, HEC, scripted, and masked PII data sources  
✅ Dedicated indexes per data source type  
✅ A visual topology map  
✅ A Lab CLI pane that shows the actual relevant config files for each source  
✅ `inputs.conf`, `outputs.conf`, `props.conf`, `transforms.conf`, `serverclass.conf`, and deployment apps wired into the flow  
✅ Regex masking on the Heavy Forwarder before events are indexed  

The most useful part wasn’t just getting it working.

It was iterating through the things that broke: embedded Splunk cookie handling, forwarders not picking up config consistently, stale HEC tokens, index routing mistakes, and figuring out where parsing actually happens.

That’s the bit I wanted from this project: not a demo, but a learning cockpit.

There’s something powerful about making infrastructure visible. When you can click a data source and immediately see the files that make it work, the mental model starts to stick.

Still rough around the edges, but it’s becoming exactly the kind of hands-on lab I wish I had when learning Splunk forwarding properly.

#Splunk #Observability #HomeLab #LearningByBuilding
