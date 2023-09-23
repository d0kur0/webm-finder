import { File, Thread, VendorImplementation } from "../types";
import { defaultUrlOverrider } from "../utils/defaultUrlOverrider";

type ThreadsResponse = [
	{
		threads: [{ no: string }];
	}
];

type ThreadResponse = {
	posts: [
		{
			ext: string;
			tim: number;
			com: string;
			sub?: string;
			time: number;
			filename: string;
		}
	];
};

export const fourChannelFactory: VendorImplementation = props => {
	const urlOverrider = props?.urlOverrider || defaultUrlOverrider;

	const fetchSubject = async (thread: Thread) => {
		const requestUrl = urlOverrider(
			`https://a.4cdn.org/${thread.board}/res/${thread.id}.json`
		);

		const response = await fetch(requestUrl);
		if (!response.ok) return undefined;

		const postsResponse: ThreadResponse = await response.json();
		const firstPost = postsResponse?.posts?.[0];
		return firstPost?.sub || firstPost?.com || undefined;
	};

	return {
		async fetchThreads(boardName: string) {
			try {
				const requestUrl = urlOverrider(`https://a.4cdn.org/${boardName}/threads.json`);
				const response: ThreadsResponse = await fetch(requestUrl).then(r => r.json());
				const flatThreads = response.map(({ threads }) => threads).flat();

				const threads = [];

				for (const flatThread of flatThreads) {
					const thread: Thread = {
						id: +flatThread.no,
						url: `https://boards.4channel.org/${boardName}/thread/${flatThread.no}`,
						board: boardName,
					};

					thread.subject = await fetchSubject(thread);
					threads.push(thread);
				}

				return threads;
			} catch (error) {
				return [];
			}
		},

		async fetchFiles(thread: Thread) {
			try {
				const requestUrl = urlOverrider(
					`https://a.4cdn.org/${thread.board}/res/${thread.id}.json`
				);

				const response = await fetch(requestUrl);
				if (!response.ok) return [];

				const filesResponse: ThreadResponse = await response.json();
				const files = filesResponse.posts
					.filter(post => post.filename)
					.map(
						(rawPost): File => ({
							url: `https://i.4cdn.org/${thread.board}/${rawPost.tim}${rawPost.ext}`,
							name: rawPost.filename,
							rootThread: { ...thread, subject: filesResponse.posts?.[0].com || "" },
							previewUrl: `https://i.4cdn.org/${thread.board}/${rawPost.tim}s.jpg`,
							date: rawPost.time,
						})
					);

				if (!props?.requiredFileTypes) return files;

				return files.filter(({ url }) => {
					const fileType = url.split(".").pop();
					return props.requiredFileTypes?.includes(fileType || "");
				});
			} catch (error) {
				return [];
			}
		},
	};
};
