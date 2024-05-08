import  { Octokit } from '@octokit/rest';

// 目的
// pullrequestのコメントを取得し、tsvで出力する

// 実行方法
// node --experimental-modules analytics_pullrequest_comments.mjs ${owner} ${repo} ${github_pat_token}

const username = process.argv[2];
const repoName = process.argv[3];
const token = process.argv[4];

const octokit = new Octokit({
  auth: token,
});

async function getPullRequests() {
  try {
    // https://docs.github.com/ja/rest/pulls/pulls?apiVersion=2022-11-28#list-pull-requests
    const response = await octokit.paginate('GET /repos/{owner}/{repo}/pulls?state=all', {
      owner: username,
      repo: repoName,
      // per_page: 1,　// 取得件数を抑えたかったが意味無し
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      }
    });
    return response;
  } catch (error) {
    console.error('Error fetching pull requests:', error);
    throw error;
  }
}

async function getPullRequestComments(prNumber) {
  try {
    // https://docs.github.com/ja/rest/pulls/pulls?apiVersion=2022-11-28#list-commits-on-a-pull-request
    const response = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/comments', {
      owner: username,
      repo: repoName,
      pull_number: prNumber,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching comments for PR #${prNumber}:`, error);
    throw error;
  }
}

// カンマ区切りで行を整形する
function parse(output) {
  let ret = [];

  ret.push(['pr_id', 'pr_title', 'pr_url', 'pr_user', 'pr_created_at', 'pr_updated_at', 'comment_body', 'comment_url', 'comment_user', 'comment_created_at']);

  for (const pr of output) {
    for (const comment of pr.comments) {
      ret.push([pr.number, pr.title, pr.url, pr.user, pr.created_at, pr.updated_at, comment.body, comment.url, comment.user, comment.created_at]);
    }
  }

  return ret;
}

async function main() {
  try {
    let output = [];

    const pullRequests = await getPullRequests();

    // 同期的に処理したいのでfor ofを使う
    for (const pr of pullRequests) {
      const pullRequestComments = await getPullRequestComments(pr.number);

      let comments = [];
      pullRequestComments.forEach(comment => {
        comments.push({
          id: comment.id,
          body: comment.body.replace(/\r?\n/g, ''), // 改行を削除
          url: comment.html_url,
          user: comment.user.login,
          created_at: comment.created_at,
        });
      });

      output.push({
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        user: pr.user.login,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        comments: comments,
      });
    }

    // csvに整形
    const csv = parse(output);

    // tsvで出力
    for (const line of csv) {
      console.log(line.join('\t'));
    }

  } catch (error) {
    console.error('An error occurred:', error);
  }
}

main();
