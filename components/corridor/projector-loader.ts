let modulePromise:ReturnType<typeof importProjector>|undefined;
function importProjector(){return import("./animated-projector");}
export function loadProjector(){return modulePromise??=importProjector();}
