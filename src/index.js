import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';

import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';

class Output extends React.Component {
	render() {
		const l = this.props.content.split("\n").map(e => {
			if (e === "") e = " ";
			return (<BlockMath math={e}/>);
		});
		return (<div>{l}</div>);
	}
}

class Modal extends React.Component {
	render() {
		if (this.props.active) {
			return (<div className="modal-overlay">
				<div className="modal">
					{this.props.children}
				</div>
			</div>);
		} else {
			return null;
		}
	}
}

class MetaInput extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			name: props.name,
			editing: false,
		};
	}
	inputKeyDown = (e) => {
		if (e.keyCode === 13) {
			this.props.rename(this.state.name); 
			this.setState({editing: false});
		}
	}
	render() {
		if (this.state.editing) {
			return (<>
				<input type="text" className="fileNameInput" value={this.state.name} onChange={(e) => this.setState({name: e.target.value})} onKeyDown={this.inputKeyDown}/>
				<button onClick={() => {this.props.rename(this.state.name); this.setState({editing: false})}}>Rename</button>
				<button onClick={() => {this.props.renameCopy(this.state.name); this.setState({editing: false})}}>Save as new document</button>
				<button onClick={() => this.setState({name: this.props.name, editing: false})}>Cancel</button>
			</>);
		} else {
			return (<><span className="fileName" onClick={() => this.setState({editing: true})}>{this.props.name}</span></>);
		}
	}
}

class DeleteFile extends React.Component {
	render() {
		return (
			<Modal active={this.props.file !== null}>
				<p>Are you sure you want to delete this file?</p>
				<button onClick={this.props.cancel}>Cancel</button>
				<button onClick={this.props.delete}>Delete</button>
			</Modal>
		);
	}
}

class FileUpload extends React.Component {
	upload = (file) => {
		file.text().then(data => {
			let id = createDocumentId();
			window.localStorage.setItem(id, JSON.stringify({
				name: file.name,
				data: data,
				lastModified: Date.now()
			}));
			window.localStorage.setItem("_last", id);
			this.props.exit();
			this.props.load(id);
		});
	}
	render() {
		return (<Modal active={this.props.active}>
			<h3>Upload file</h3>
			<input style={{display: "block", marginBottom: 30}} type="file" onChange={(e) => this.upload(e.target.files[0])} />
			<button onClick={this.props.exit}>Cancel</button>
		</Modal>);
	}
}

class Browser extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			uploading: false,
			deleting: null,
		};
	}
	render() {
		let docs = [];
		for (let i = 0; i < window.localStorage.length; i++) {
			const k = window.localStorage.key(i);
			if (k !== "_last" && k !== null) {
				let d = JSON.parse(window.localStorage.getItem(k));
				d.id = k
				docs.push(d);
			}
		}
		docs.sort((a, b) => { return b.lastModified - a.lastModified});
		return <div id="browser">
			<FileUpload active={this.state.uploading} exit={() => {this.setState({uploading: false})}} load={this.props.loadFunc}/>
			<DeleteFile file={this.state.deleting} cancel={() => this.setState({deleting: null})} delete={()=>{
				window.localStorage.removeItem(this.state.deleting);
				this.setState({deleting: null});
				this.props.newDoc();
			}} />
			<div className="browser-buttons">
				<button onClick={this.props.closeFunc}>Close file browser</button>
				<button onClick={() => this.setState({uploading: true})}>Upload local file</button>
			</div>
			{docs.map((doc) => {
				const diff = (Date.now() - doc.lastModified)/1000; // seconds
				let dateString = "";
				if (diff > 24*3600*7) {
					dateString = new Date(doc.lastModified).toLocaleDateString("en-US", {year: 'numeric', month: 'long', day: 'numeric'});
				} else if (diff > 24*3600*2) {
					dateString = Math.floor(diff/(24*3600)) + " days ago";
				} else if (diff > 24*3600) {
					dateString = "Yesterday at " + new Date(doc.lastModified).toLocaleTimeString("en-US", {timeStyle: "short", hourCycle: "h24"});
				} else if (diff > 2*3600) {
					dateString = Math.floor(diff/3600) + " hours ago";
				} else if (diff > 3600) {
						dateString = "1 hour ago";
				} else if (diff > 120) {
					dateString = Math.floor(diff/60) + " minutes ago";
				} else if (diff > 60) {
					dateString = "1 minute ago";
				} else {
					dateString = "A few seconds ago";
				}

				return <div key={doc.id} onClick={() => this.props.loadFunc(doc.id)} className={"browser-doc" + (this.props.current === doc.id ? " browser-current" : "")}>
					{doc.name} <span style={{color: "#999"}}>{dateString}</span> 
					<button onClick={() => this.setState({deleting: doc.id})} className="delete-button">Delete</button>
				</div>;
			})}
		</div>;
	}
}

const createDocumentId = () => {
	return require("uuid").v4();
}

class App extends React.Component {
	getDataFromUrl = () => {
		const urlParams = new URLSearchParams(window.location.search);
		let n = urlParams.get('name');
		let d = urlParams.get('data');
		let m = urlParams.get('mode');
		this.setState({
			name: (n === "") ? "Unnamed" : n,
			hidden: (m === "view") ? true : false,
		});
		if (d != null) {
			this.setState({content: d});
			return true;
		}
		return false;
	}
	constructor(props) {
		super(props);
		this.state = {
			documentId: createDocumentId(),
			doucmentName: "Unnamed",
			content: "",
			hidden: false,
			browsing: false,
			displayHelp: false,
		};
	}
	componentDidMount() {
		if (!this.getDataFromUrl()) {
			this.loadDoc("_last");
		}
		this.autosave = setInterval(
			() => this.saveDoc(),
			5000
		);
	}
	componentWillUnmount() {
		clearInterval(this.autosave);
	}
	saveDoc = () => {
		if (this.state.content !== "") {
			let id = this.state.documentId;
			if (this.state.documentId === "-1") {
				id = createDocumentId()
				this.setState({documentId: id});
			}
			const old = JSON.parse(window.localStorage.getItem(id));
			if (old === null || old.data !== this.state.content || old.name !== this.state.doucmentName) {
				window.localStorage.setItem(id, JSON.stringify({
					name: this.state.doucmentName,
					data: this.state.content,
					lastModified: Date.now()
				}));
			}
			window.localStorage.setItem("_last", id);
		}
	}
	loadDoc = (id) => {
		if (id === "_last") id = window.localStorage.getItem("_last");
		const doc = JSON.parse(window.localStorage.getItem(id));
		if (doc !== null) {
			this.setState({
				documentId: id,
				doucmentName: doc.name,
				content: doc.data
			});
		}
	}
	getDocURL = () => {
		const urlParams = new URLSearchParams(window.location.search);
		urlParams.set('name', this.state.doucmentName);
		urlParams.set('mode', this.state.hidden ? "view" : "edit");
		urlParams.set('data', this.state.content);
		return window.location.protocol + '//' + window.location.host + window.location.pathname + "?" + urlParams.toString();
	}
	download = () => {
		var element = document.createElement('a');
		element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(this.state.content));
		element.setAttribute('download', this.state.doucmentName + ".tex");
	  
		element.style.display = 'none';
		document.body.appendChild(element);
	  
		element.click();
	  
		document.body.removeChild(element);
	  }
	change = (field) => (event) => {this.setState({[field]: event.target.value})}
	render() {
		return (
			<>
				<div className={"main" + (this.state.hidden ? " hidden" : "") + (this.state.browsing ? " browsing" : "")}>
					<div className="bar">
						<img alt="" style={{height: 24, marginRight: 10}} src="LogoS.png" />
						<span style={{marginRight: "auto"}}>{"Granulat — "}
						<MetaInput rename={(n)=>{this.setState({doucmentName: n})}} renameCopy={(n)=>{this.saveDoc(); this.setState({documentId: createDocumentId(), doucmentName: n}); this.saveDoc()}} name={this.state.doucmentName} /></span>
						<button onClick={() => {this.saveDoc(); this.setState({documentId: "-1", doucmentName: "Unnamed", content: ""}); window.localStorage.setItem("_last", "-1");}}>New</button>
						<button onClick={() => this.saveDoc()}>Save</button>
						<button onClick={() => {this.saveDoc(); this.setState({browsing: true});}}>Browse files</button>
						<button onClick={() => this.download()}>Download</button>
						<button onClick={() => navigator.clipboard.writeText(this.getDocURL())} disabled={this.state.content.length > 1700 ? true : false}>Copy link</button>
						<button onClick={() => this.setState({displayHelp: true})} className="helpButton">?</button>
					</div>
					<div className="input-container">
						<textarea autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" className="input" value={this.state.content} onChange={this.change("content")}/>
						<button id="input-btn" onClick={()=>{this.setState(prev => ({hidden: !prev.hidden}))}}>{(this.state.hidden ? "Edit >>" : "<<")}</button>
					</div>
					<div className="output">
						<Output content={this.state.content} />
					</div>
					<Browser current={this.state.documentId} loadFunc={this.loadDoc} closeFunc={()=>{this.setState({browsing: false})}} newDoc={() => {this.setState({documentId: "-1", doucmentName: "Unnamed", content: ""}); window.localStorage.setItem("_last", "-1");}}/>
					<Modal active={this.state.displayHelp}>
						<img alt="" style={{maxWidth: "30%", margin: "0 auto", display: "block"}} src="LogoL.png" />
						<h4 style={{textAlign: "center", marginTop: "0px"}}>granulat by atmatto</h4>
						<p style={{textAlign: "center", marginTop: "-20px"}}><em>a simple local-first KaTeX equations editor and viewer</em></p>
						<p>This app's window is divided into two main parts. On the left there is the editor and on the right there is the viewer.</p>
						<p>You can hide the editor using a button at the top right hand corner of it.</p>
						<p>Your documents are saved locally in your browser. You can save documents and browse saved documents using the buttons
							at the top right hand corner of the window.</p>
						<p>You can rename your document by clicking its name at the top left hand corner of the window.</p>
						<p>There are two ways to share your documents. You can download them as a text file by clicking the 'download' button or you can
							click 'copy link' to copy a link containing your document. Copying a link may be unavailable if your document is too big.</p>
						<p>See <a target="_blank" rel="noopener noreferrer" href="https://katex.org/docs/supported.html">this site</a> for available TeX functions.</p>
						<button onClick={() => {this.setState({displayHelp: false})}}>Close</button>
					</Modal>
				</div>
			</>
		)
	}
}

ReactDOM.render(
	<App/>,
	document.getElementById('root')
);