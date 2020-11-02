const fs = require( 'fs' ).promises;
const core = require( '@actions/core' );
const github = require( '@actions/github' );

const context = github.context;

const commentHeader = '<!-- ActionId: pull-request-diff-comment-action -->\n';
const runMarker = `<!-- RunId: ${ context.runId } -->\n`;
const diffMarkdownHeader = '```diff\n';
const diffMarkdownFooter = '\n```';

function detailedInfo( msg, params ) {
	const paramsJson = JSON.stringify( params, null, 2 );
	core.info( `${ msg }: ${ paramsJson }` );
}

async function getPullRequestComments( octokit, pullRequest ) {

	const query = `
query comments( $owner: String!, $repo: String! $number: Int! ) {
	repository( owner: $owner, name: $repo ) {
		pullRequest( number: $number ) {
			id
			comments( last: 10 ) {
				nodes {
					id
					body
					isMinimized,
					author {
						... on Bot {
							id
							login
						}
					}
				}
			}
		}
	}
}
	`;

	detailedInfo( 'Querying pull request comments', pullRequest );
	const result = await octokit.graphql( query, pullRequest );

	const comments = result.repository.pullRequest.comments.nodes;
	return comments;
}

async function minimizeComment( octokit, commentId ) {

	const mutation = `
mutation commentMutation( $subjectId: String! ) {
	__typename
	minimizeComment(
		input: {
			subjectId: $subjectId,
			classifier: OUTDATED
		}
	) {
		clientMutationId
	}
}
	`;

	const args = {
		subjectId: commentId
	};

	detailedInfo( 'Minimizing comment', args );
	try {
		await octokit.graphql( mutation, args );

	} catch( err ) {
		core.error( `Failed to minimize comment: ${ err.message }` );
	}
}

function isNonMinimizedDiffComment( comment ) {

	if( comment.isMinimized ) {
		return false;
	}

	if( comment.author.login !== 'github-actions' )  {
		return false;
	}

	if( !comment.body.startsWith( commentHeader ) ) {
		return false;
	}

	if( comment.body.indexOf( runMarker, commentHeader.length ) >= 0 ) {
		return false;
	}

	return true;
}

async function run() {
	try {
		const diffPath = core.getInput(
				'diff-path', 
				{ required: true }
			);

		const token = core.getInput(
				'github-token',
				{ required: true }
			);

		core.info( `Reading diff: ${ diffPath }` );
		const diff = await fs.readFile(
				diffPath,
				{ encoding: 'utf8' }
			);

		const octokit = github.getOctokit( token );

		const comments = await getPullRequestComments( octokit, context.issue );
		detailedInfo( "Fetched comments", comments );

		const outdatedComments = comments.filter( isNonMinimizedDiffComment );
		for( const comment of outdatedComments ) {
			await minimizeComment( octokit, comment.id );
		}

		const body = (
				commentHeader
				+ runMarker
				+ diffMarkdownHeader
				+ diff.trim()
				+ diffMarkdownFooter
			);

		const commentArgs = {
			owner: context.issue.owner,
			repo: context.issue.repo,
			issue_number: context.issue.number,
			body: body
		};

		detailedInfo( "Creating comment", commentArgs );
		await octokit.issues.createComment( commentArgs );

	} catch( error ) {
		core.setFailed( error.message );
	}
}

run();
